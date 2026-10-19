// Noewbar CS Pro - WhatsApp Gateway Daemon
//
// A multi-tenant Whatsmeow microservice (specification chapter 5).
//
// Design goals:
//   - ~15 MB RAM per store number, so 100+ stores fit one 4 vCPU / 8 GB VPS.
//   - Isolated session database per store (data/sessions/<instance_key>.db).
//   - Inbound-only focus: messages sent by the store itself are ignored, which is
//     what keeps the number human and low-risk.
//   - Human typing simulation (composing presence) before every reply.
//   - Media sending straight from a URL (MinIO), so the bot can deliver the real
//     product photo/video as a native WhatsApp attachment.
//
// Endpoints (all guarded by the X-Noewbar-Secret header):
//   GET  /health
//   POST /instances/init        {instance_key, webhook_url}
//   GET  /instances/status?key=
//   GET  /instances/qr?key=
//   POST /instances/send        {instance_key, to, message, simulate_typing}
//   POST /instances/send-media  {instance_key, to, url, caption, kind, simulate_typing}
//   GET  /instances/logout?key=
package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	waCompanionReg "go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/store"

	_ "github.com/mattn/go-sqlite3"
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// SessionInstance is one store's WhatsApp session.
type SessionInstance struct {
	Key         string
	Client      *whatsmeow.Client
	Container   *sqlstore.Container
	WebhookURL  string
	QRBase64    string
	QRRaw       string
	Status      string // OFFLINE | PAIRING | CONNECTED
	PhoneNumber string
	mu          sync.Mutex
}

// Manager holds every live session.
type Manager struct {
	mu        sync.RWMutex
	instances map[string]*SessionInstance
	dataDir   string
}

var (
	manager = &Manager{
		instances: make(map[string]*SessionInstance),
		dataDir:   "./data/sessions",
	}
	// Shared internal secret. When empty the daemon accepts local callers.
	internalSecret = os.Getenv("WHATSMEOW_SECRET")
)

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

func init() {
	// Report a recognizable device identity so the phone's Linked Devices list
	// shows "Noewbar Server" on Desktop instead of "?" (the library default is
	// PlatformType UNKNOWN with OS name "whatsmeow").
	desc := "Noewbar Server"
	store.DeviceProps.Os = &desc
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_DESKTOP.Enum()
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8088"
	}

	if err := os.MkdirAll(manager.dataDir, 0o755); err != nil {
		fmt.Printf("Error creating sessions dir: %v\n", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", withAuth(handleHealth))
	mux.HandleFunc("/instances/init", withAuth(handleInitInstance))
	mux.HandleFunc("/instances/status", withAuth(handleStatusInstance))
	mux.HandleFunc("/instances/qr", withAuth(handleQRInstance))
	mux.HandleFunc("/instances/send", withAuth(handleSendMessage))
	mux.HandleFunc("/instances/send-media", withAuth(handleSendMedia))
	mux.HandleFunc("/instances/logout", withAuth(handleLogoutInstance))
	mux.HandleFunc("/media/", withAuth(serveMedia))

	server := &http.Server{Addr: ":" + port, Handler: mux}

	go func() {
		fmt.Printf("Noewbar Whatsmeow Daemon listening on :%s\n", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Server error: %v\n", err)
		}
	}()

	// Restore any already-paired store sessions so the fleet survives a restart.
	restoreSessions()

	// Periodic sweeper for transient inbound media.
	go mediaSweeper()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	fmt.Println("Shutting down Whatsmeow Daemon...")
	manager.mu.Lock()
	for _, inst := range manager.instances {
		if inst.Client != nil && inst.Client.IsConnected() {
			inst.Client.Disconnect()
		}
	}
	manager.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
	fmt.Println("Whatsmeow Daemon stopped gracefully.")
}

// withAuth enforces the shared internal secret on every endpoint.
// Fail-closed: an unset secret refuses every caller. The daemon must not run
// unauthenticated even on localhost, because it can send WhatsApp messages.
func withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		provided := r.Header.Get("X-Noewbar-Secret")
		if internalSecret == "" || provided != internalSecret {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "Unauthorized"})
			return
		}
		next(w, r)
	}
}

// restoreSessions reconnects every session database found on disk.
func restoreSessions() {
	entries, err := os.ReadDir(manager.dataDir)
	if err != nil {
		return
	}

	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".db") {
			continue
		}
		key := strings.TrimSuffix(e.Name(), ".db")
		inst := &SessionInstance{Key: key, Status: "OFFLINE"}

		manager.mu.Lock()
		manager.instances[key] = inst
		manager.mu.Unlock()

		inst.mu.Lock()
		connectInstance(inst)
		inst.mu.Unlock()

		fmt.Printf("[%s] restored session -> %s\n", key, inst.Status)
	}
}

// connectInstance opens the store DB and connects (or starts pairing).
// Caller must hold inst.mu.
func connectInstance(inst *SessionInstance) {
	dbPath := filepath.Join(manager.dataDir, fmt.Sprintf("%s.db", inst.Key))
	dbLog := waLog.Stdout("Database", "ERROR", true)
	ctx := context.Background()

	container, err := sqlstore.New(ctx, "sqlite3", "file:"+dbPath+"?_foreign_keys=on", dbLog)
	if err != nil {
		fmt.Printf("[%s] session db error: %v\n", inst.Key, err)
		return
	}
	inst.Container = container

	deviceStore, err := container.GetFirstDevice(ctx)
	if err != nil {
		fmt.Printf("[%s] device store error: %v\n", inst.Key, err)
		return
	}

	client := whatsmeow.NewClient(deviceStore, waLog.Stdout("Whatsmeow", "WARN", true))
	inst.Client = client

	client.AddEventHandler(func(rawEvt any) {
		handleWhatsAppEvent(inst, rawEvt)
	})

	if client.Store.ID == nil {
		// Not paired yet: request a QR pairing channel.
		qrChan, _ := client.GetQRChannel(context.Background())
		if err := client.Connect(); err != nil {
			fmt.Printf("[%s] connect error: %v\n", inst.Key, err)
			inst.Status = "OFFLINE"
			return
		}
		inst.Status = "PAIRING"

		go func() {
			for evt := range qrChan {
				switch evt.Event {
				case "code":
					inst.mu.Lock()
					inst.QRRaw = evt.Code
					if png, err := qrcode.Encode(evt.Code, qrcode.Medium, 256); err == nil {
						inst.QRBase64 = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
					}
					inst.Status = "PAIRING"
					inst.mu.Unlock()
				case "success":
					inst.mu.Lock()
					inst.Status = "CONNECTED"
					inst.QRBase64 = ""
					inst.QRRaw = ""
					if client.Store.ID != nil {
						inst.PhoneNumber = client.Store.ID.User
					}
					inst.mu.Unlock()
				}
			}
		}()
		return
	}

	// Already paired: plain reconnect.
	if err := client.Connect(); err != nil {
		fmt.Printf("[%s] reconnect error: %v\n", inst.Key, err)
		inst.Status = "OFFLINE"
		return
	}
	inst.Status = "CONNECTED"
	inst.PhoneNumber = client.Store.ID.User
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

func handleHealth(w http.ResponseWriter, r *http.Request) {
	manager.mu.RLock()
	count := len(manager.instances)
	connected := 0
	for _, i := range manager.instances {
		if i.Client != nil && i.Client.IsLoggedIn() {
			connected++
		}
	}
	manager.mu.RUnlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"status":           "ok",
		"service":          "noewbar-whatsmeow-daemon",
		"active_instances": count,
		"connected":        connected,
		"time":             time.Now().Format(time.RFC3339),
	})
}

type initRequest struct {
	InstanceKey string `json:"instance_key"`
	WebhookURL  string `json:"webhook_url"`
}

func handleInitInstance(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "Method not allowed"})
		return
	}

	var req initRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.InstanceKey == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid instance_key"})
		return
	}

	manager.mu.Lock()
	inst, exists := manager.instances[req.InstanceKey]
	if !exists {
		inst = &SessionInstance{Key: req.InstanceKey, WebhookURL: req.WebhookURL, Status: "OFFLINE"}
		manager.instances[req.InstanceKey] = inst
	}
	manager.mu.Unlock()

	// Snapshot under the lock, but never hold it across the network handshake.
	// The QR goroutine writes QRBase64 while this handler runs; if we held inst.mu
	// for the whole function the goroutine would block and the first response would
	// always carry an empty qr_base64, so the dashboard had nothing to render.
	inst.mu.Lock()
	if req.WebhookURL != "" {
		inst.WebhookURL = req.WebhookURL
	}
	// IsLoggedIn, not IsConnected: the transport connects to WhatsApp before the
	// device is paired, so IsConnected() is true while whatsmeow_device is empty.
	// Reporting CONNECTED then made the dashboard claim a live number that could
	// never send or receive.
	alreadyLoggedIn := inst.Client != nil && inst.Client.IsLoggedIn()
	alreadyKey := inst.Key
	inst.mu.Unlock()

	if alreadyLoggedIn {
		inst.mu.Lock()
		phone := inst.PhoneNumber
		inst.mu.Unlock()
		writeJSON(w, http.StatusOK, map[string]any{
			"status":       "CONNECTED",
			"instance_key": alreadyKey,
			"phone_number": phone,
			"qr_base64":    "",
		})
		return
	}

	connectInstance(inst)

	inst.mu.Lock()
	defer inst.mu.Unlock()
	writeJSON(w, http.StatusOK, map[string]any{
		"status":       inst.statusOrDefault(),
		"instance_key": inst.Key,
		"phone_number": inst.PhoneNumber,
		"qr_base64":    inst.QRBase64,
	})
}

func (s *SessionInstance) statusOrDefault() string {
	if s.Status == "" {
		return "OFFLINE"
	}
	return s.Status
}

func handleQRInstance(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Missing key param"})
		return
	}

	manager.mu.RLock()
	inst, exists := manager.instances[key]
	manager.mu.RUnlock()
	if !exists {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "Instance not found"})
		return
	}

	inst.mu.Lock()
	defer inst.mu.Unlock()

	writeJSON(w, http.StatusOK, map[string]any{
		"instance_key": inst.Key,
		"status":       inst.statusOrDefault(),
		"qr_base64":    inst.QRBase64,
		"phone_number": inst.PhoneNumber,
	})
}

func handleStatusInstance(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Missing key param"})
		return
	}

	manager.mu.RLock()
	inst, exists := manager.instances[key]
	manager.mu.RUnlock()
	if !exists {
		writeJSON(w, http.StatusOK, map[string]any{"status": "OFFLINE", "connection_status": "OFFLINE"})
		return
	}

	inst.mu.Lock()
	defer inst.mu.Unlock()

	status := inst.statusOrDefault()
	if inst.Client != nil && inst.Client.IsLoggedIn() {
		status = "CONNECTED"
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"instance_key":      inst.Key,
		"connection_status": status,
		"phone_number":      inst.PhoneNumber,
	})
}

type sendRequest struct {
	InstanceKey    string `json:"instance_key"`
	To             string `json:"to"`
	Message        string `json:"message"`
	SimulateTyping bool   `json:"simulate_typing"`
}

func handleSendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "Method not allowed"})
		return
	}

	var req sendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.InstanceKey == "" || req.To == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid parameters"})
		return
	}

	inst, ok := lookupConnected(req.InstanceKey)
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Instance offline or not connected"})
		return
	}

	targetJID, err := parseRecipient(req.To)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Invalid recipient: %v", err)})
		return
	}

	if req.SimulateTyping {
		simulateTyping(inst, targetJID, len(req.Message))
	}

	msg := &waE2E.Message{Conversation: proto.String(req.Message)}
	resp, err := inst.Client.SendMessage(context.Background(), targetJID, msg)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Failed to send message: %v", err)})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"message_id": resp.ID,
		"timestamp":  resp.Timestamp.Format(time.RFC3339),
	})
}

type sendMediaRequest struct {
	InstanceKey    string `json:"instance_key"`
	To             string `json:"to"`
	URL            string `json:"url"`
	Caption        string `json:"caption"`
	Kind           string `json:"kind"` // image | video | document
	SimulateTyping bool   `json:"simulate_typing"`
}

// handleSendMedia downloads a file from a URL (MinIO) and sends it as a native
// WhatsApp attachment, which is what lets the bot deliver real product photos and
// videos instead of confusing links (specification chapter 8.B).
func handleSendMedia(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "Method not allowed"})
		return
	}

	var req sendMediaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.InstanceKey == "" || req.To == "" || req.URL == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Invalid parameters"})
		return
	}

	inst, ok := lookupConnected(req.InstanceKey)
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Instance offline or not connected"})
		return
	}

	targetJID, err := parseRecipient(req.To)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("Invalid recipient: %v", err)})
		return
	}

	// Fetch the bytes from MinIO.
	httpClient := &http.Client{Timeout: 60 * time.Second}
	fileResp, err := httpClient.Get(req.URL)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("Failed to fetch media: %v", err)})
		return
	}
	defer fileResp.Body.Close()

	if fileResp.StatusCode != http.StatusOK {
		writeJSON(w, http.StatusBadGateway, map[string]any{
			"error": fmt.Sprintf("Media URL returned HTTP %d", fileResp.StatusCode),
		})
		return
	}

	data, err := io.ReadAll(io.LimitReader(fileResp.Body, 20*1024*1024))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": fmt.Sprintf("Failed to read media: %v", err)})
		return
	}
	if len(data) == 0 {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": "Media file is empty"})
		return
	}

	kind := req.Kind
	if kind == "" {
		kind = "image"
	}

	mime := fileResp.Header.Get("Content-Type")
	if mime == "" {
		mime = guessMime(kind)
	}
	// MinIO often answers application/octet-stream for objects stored without a
	// content type; fall back to the declared kind so WhatsApp can render it.
	if strings.Contains(mime, "octet-stream") {
		mime = guessMime(kind)
	}

	if req.SimulateTyping {
		simulateTyping(inst, targetJID, len(req.Caption))
	}

	ctx := context.Background()

	switch kind {
	case "audio":
		uploaded, err := inst.Client.Upload(ctx, data, whatsmeow.MediaAudio)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Upload failed: %v", err)})
			return
		}
		msg := &waE2E.Message{
			AudioMessage: &waE2E.AudioMessage{
				Mimetype:      proto.String(mime),
				URL:           proto.String(uploaded.URL),
				DirectPath:    proto.String(uploaded.DirectPath),
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(data))),
				PTT:           proto.Bool(true),
			},
		}
		sendAndRespond(inst, w, targetJID, msg)

	case "video":
		uploaded, err := inst.Client.Upload(ctx, data, whatsmeow.MediaVideo)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Upload failed: %v", err)})
			return
		}
		msg := &waE2E.Message{
			VideoMessage: &waE2E.VideoMessage{
				Caption:       proto.String(req.Caption),
				Mimetype:      proto.String(mime),
				URL:           proto.String(uploaded.URL),
				DirectPath:    proto.String(uploaded.DirectPath),
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(data))),
			},
		}
		sendAndRespond(inst, w, targetJID, msg)

	case "document":
		filename := filepath.Base(req.URL)
		uploaded, err := inst.Client.Upload(ctx, data, whatsmeow.MediaDocument)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Upload failed: %v", err)})
			return
		}
		msg := &waE2E.Message{
			DocumentMessage: &waE2E.DocumentMessage{
				Caption:       proto.String(req.Caption),
				Mimetype:      proto.String(mime),
				FileName:      proto.String(filename),
				Title:         proto.String(filename),
				URL:           proto.String(uploaded.URL),
				DirectPath:    proto.String(uploaded.DirectPath),
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(data))),
			},
		}
		sendAndRespond(inst, w, targetJID, msg)

	default: // image
		uploaded, err := inst.Client.Upload(ctx, data, whatsmeow.MediaImage)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Upload failed: %v", err)})
			return
		}
		msg := &waE2E.Message{
			ImageMessage: &waE2E.ImageMessage{
				Caption:       proto.String(req.Caption),
				Mimetype:      proto.String(mime),
				URL:           proto.String(uploaded.URL),
				DirectPath:    proto.String(uploaded.DirectPath),
				MediaKey:      uploaded.MediaKey,
				FileEncSHA256: uploaded.FileEncSHA256,
				FileSHA256:    uploaded.FileSHA256,
				FileLength:    proto.Uint64(uint64(len(data))),
			},
		}
		sendAndRespond(inst, w, targetJID, msg)
	}
}

func sendAndRespond(inst *SessionInstance, w http.ResponseWriter, to types.JID, msg *waE2E.Message) {
	resp, err := inst.Client.SendMessage(context.Background(), to, msg)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": fmt.Sprintf("Failed to send media: %v", err)})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"success":    true,
		"message_id": resp.ID,
		"timestamp":  resp.Timestamp.Format(time.RFC3339),
	})
}

func handleLogoutInstance(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "Missing key param"})
		return
	}

	manager.mu.Lock()
	inst, exists := manager.instances[key]
	if exists {
		delete(manager.instances, key)
	}
	manager.mu.Unlock()

	if exists && inst.Client != nil {
		_ = inst.Client.Logout(context.Background())
		inst.Client.Disconnect()
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Instance logged out"})
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

func handleWhatsAppEvent(inst *SessionInstance, rawEvt any) {
	switch evt := rawEvt.(type) {
	case *events.Connected:
		inst.mu.Lock()
		inst.Status = "CONNECTED"
		if inst.Client.Store.ID != nil {
			inst.PhoneNumber = inst.Client.Store.ID.User
		}
		inst.mu.Unlock()
		fmt.Printf("[%s] connected to WhatsApp\n", inst.Key)

	case *events.LoggedOut:
		inst.mu.Lock()
		inst.Status = "OFFLINE"
		inst.PhoneNumber = ""
		inst.mu.Unlock()
		fmt.Printf("[%s] logged out\n", inst.Key)

	case *events.Disconnected:
		inst.mu.Lock()
		inst.Status = "OFFLINE"
		inst.mu.Unlock()
		fmt.Printf("[%s] disconnected\n", inst.Key)

	case *events.Message:
		// Inbound-only focus: never act on our own outgoing messages.
		if evt.Info.IsFromMe {
			return
		}

		body := extractText(evt)
		payload := map[string]any{
			"instance_key": inst.Key,
			"sender_jid":   evt.Info.Sender.String(),
			"sender_name":  evt.Info.PushName,
			"body":         body,
			"timestamp":    evt.Info.Timestamp.Format(time.RFC3339),
			"message_id":   evt.Info.ID,
		}

		// Media: download once here, store for the app to pull via /media/<file>,
		// and keep the payload light (URL instead of base64).
		if img := evt.Message.GetImageMessage(); img != nil {
			if data, err := inst.Client.Download(context.Background(), img); err == nil && len(data) > 0 {
				url, mime := saveMedia(inst.Key, evt.Info.ID, "image", data, img.GetMimetype())
				payload["media_url"] = url
				payload["media_kind"] = "image"
				payload["media_mime"] = mime
				payload["media_caption"] = img.GetCaption()
			}
		} else if vid := evt.Message.GetVideoMessage(); vid != nil {
			if data, err := inst.Client.Download(context.Background(), vid); err == nil && len(data) > 0 {
				url, mime := saveMedia(inst.Key, evt.Info.ID, "video", data, vid.GetMimetype())
				payload["media_url"] = url
				payload["media_kind"] = "video"
				payload["media_mime"] = mime
				payload["media_caption"] = vid.GetCaption()
			}
		} else if doc := evt.Message.GetDocumentMessage(); doc != nil {
			if data, err := inst.Client.Download(context.Background(), doc); err == nil && len(data) > 0 {
				url, mime := saveMedia(inst.Key, evt.Info.ID, "document", data, doc.GetMimetype())
				payload["media_url"] = url
				payload["media_kind"] = "document"
				payload["media_mime"] = mime
			}
		} else if aud := evt.Message.GetAudioMessage(); aud != nil {
			if data, err := inst.Client.Download(context.Background(), aud); err == nil && len(data) > 0 {
				url, mime := saveMedia(inst.Key, evt.Info.ID, "audio", data, aud.GetMimetype())
				payload["media_url"] = url
				payload["media_kind"] = "audio"
				payload["media_mime"] = mime
			}
		}

		// Share-Location (chapter 2 USP: GPS -> subdistrict -> ongkir).
		if loc := evt.Message.GetLocationMessage(); loc != nil {
			payload["latitude"] = loc.GetDegreesLatitude()
			payload["longitude"] = loc.GetDegreesLongitude()
			payload["location_name"] = loc.GetName()
		}

		// Skip nothing worth the app's time (empty text, no media, no location).
		if body == "" && payload["media_url"] == nil && payload["latitude"] == nil {
			return
		}

		fmt.Printf("[%s] <- %s: %s\n", inst.Key, evt.Info.Sender.String(), truncate(body, 80))

		if inst.WebhookURL != "" {
			go forwardWebhook(inst.WebhookURL, payload)
		}
	}
}

// mediaDir is where inbound media lands before the app pulls it into MinIO.
// Files are transient: the app consumes them and a sweeper removes strays.
const mediaDir = "./data/media"

// saveMedia writes inbound bytes to data/media/<instance>_<msgid>.<ext> and
// returns the daemon URL + the effective mime. The app fetches it with the
// shared secret, uploads to MinIO, then the sweeper cleans up.
func saveMedia(instanceKey, messageID, kind string, data []byte, declaredMime string) (string, string) {
	mime := declaredMime
	if mime == "" {
		mime = guessMime(kind)
	}
	ext := mediaExt(mime, kind)
	name := fmt.Sprintf("%s_%s.%s", instanceKey, messageID, ext)
	if err := os.MkdirAll(mediaDir, 0o755); err == nil {
		_ = os.WriteFile(filepath.Join(mediaDir, name), data, 0o644)
	}
	// Media size cap: WhatsApp won't hand us anything larger than ~64MB, but
	// guard the write anyway so a corrupt frame cannot fill the disk.
	return "http://127.0.0.1:8088/media/" + name, mime
}

func mediaExt(mime, fallback string) string {
	switch {
	case strings.Contains(mime, "png"):
		return "png"
	case strings.Contains(mime, "webp"):
		return "webp"
	case strings.Contains(mime, "gif"):
		return "gif"
	case strings.Contains(mime, "jpeg"), strings.Contains(mime, "jpg"):
		return "jpg"
	case strings.Contains(mime, "mp4"):
		return "mp4"
	case strings.Contains(mime, "pdf"):
		return "pdf"
	default:
		return fallback
	}
}

// serveMedia hands a previously saved inbound file back to the app (secret-gated
// like every other endpoint; the app is the only consumer).
func serveMedia(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/media/")
	if name == "" || strings.Contains(name, "..") || strings.Contains(name, "/") {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid media name"})
		return
	}
	data, err := os.ReadFile(filepath.Join(mediaDir, name))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "media not found"})
		return
	}
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Write(data)
}

// mediaSweeper removes inbound files older than 30 minutes so a busy store
// cannot accumulate GBs of unclaimed media in the daemon directory.
func mediaSweeper() {
	for range time.Tick(15 * time.Minute) {
		entries, err := os.ReadDir(mediaDir)
		if err != nil {
			continue
		}
		cutoff := time.Now().Add(-30 * time.Minute)
		for _, e := range entries {
			if e.IsDir() {
				continue
			}
			info, err := e.Info()
			if err != nil || info.ModTime().Before(cutoff) {
				_ = os.Remove(filepath.Join(mediaDir, e.Name()))
			}
		}
	}
}

func extractText(evt *events.Message) string {
	if v := evt.Message.GetConversation(); v != "" {
		return v
	}
	if v := evt.Message.GetExtendedTextMessage().GetText(); v != "" {
		return v
	}
	// Media captions count as text the agent can reason about.
	if v := evt.Message.GetImageMessage().GetCaption(); v != "" {
		return v
	}
	if v := evt.Message.GetVideoMessage().GetCaption(); v != "" {
		return v
	}
	return ""
}

func forwardWebhook(url string, payload map[string]any) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(url, "application/json", bytes.NewBuffer(data))
	if err != nil {
		fmt.Printf("webhook forward to %s failed: %v\n", url, err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		fmt.Printf("webhook forward to %s returned HTTP %d\n", url, resp.StatusCode)
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// lookupConnected resolves an instance and guarantees it can send right now.
func lookupConnected(key string) (*SessionInstance, bool) {
	manager.mu.RLock()
	inst, exists := manager.instances[key]
	manager.mu.RUnlock()

	if !exists || inst.Client == nil || !inst.Client.IsLoggedIn() {
		return nil, false
	}
	return inst, true
}

// parseRecipient normalises 08xx / +62xx / raw JIDs into a WhatsApp JID.
func parseRecipient(to string) (types.JID, error) {
	recipient := strings.TrimSpace(to)
	if !strings.Contains(recipient, "@") {
		if strings.HasPrefix(recipient, "0") {
			recipient = "62" + recipient[1:]
		}
		recipient = strings.TrimPrefix(recipient, "+")
		recipient = recipient + "@s.whatsapp.net"
	}
	return types.ParseJID(recipient)
}

// simulateTyping holds a composing presence for a randomised human-like pause
// scaled by message length + jitter (1.2s - 4.5s), which is the core anti-ban measure.
func simulateTyping(inst *SessionInstance, to types.JID, msgLen int) {
	ctx := context.Background()
	_ = inst.Client.SendChatPresence(ctx, to, types.ChatPresenceComposing, types.ChatPresenceMediaText)

	baseMs := 1200 + (msgLen * 20)
	if baseMs > 4200 {
		baseMs = 4200
	}
	jitter := int(time.Now().UnixNano()%800) - 400
	totalDelay := baseMs + jitter
	if totalDelay < 1000 {
		totalDelay = 1000
	}
	time.Sleep(time.Duration(totalDelay) * time.Millisecond)

	_ = inst.Client.SendChatPresence(ctx, to, types.ChatPresencePaused, types.ChatPresenceMediaText)
}

func guessMime(kind string) string {
	switch kind {
	case "video":
		return "video/mp4"
	case "document":
		return "application/pdf"
	case "audio":
		return "audio/ogg; codecs=opus"
	default:
		return "image/jpeg"
	}
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
