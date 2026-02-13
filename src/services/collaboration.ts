// Collaboration WebSocket client for real-time editing
type CollaborationMessage = {
  type: "join" | "leave" | "cursor" | "presence" | "edit";
  userId: string;
  username: string;
  fileId: string;
  data?: any;
  timestamp: number;
};

type PresenceUser = {
  userId: string;
  username: string;
  fileId: string;
  cursorPosition?: number;
  lastSeen: number;
};

type CollaborationEventHandler = (message: CollaborationMessage) => void;
type PresenceEventHandler = (users: PresenceUser[]) => void;

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private fileId: string;
  private userId: string;
  private username: string;
  private messageHandlers: Set<CollaborationEventHandler> = new Set();
  private presenceHandlers: Set<PresenceEventHandler> = new Set();
  private reconnectTimeout?: number;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(fileId: string, userId: string, username: string) {
    this.fileId = fileId;
    this.userId = userId;
    this.username = username;
  }

  connect(): void {
    const wsUrl = this.getWebSocketUrl();

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.addEventListener("open", () => {
        console.log("Collaboration WebSocket connected");
        this.reconnectAttempts = 0;
      });

      this.ws.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data) as CollaborationMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      });

      this.ws.addEventListener("close", () => {
        console.log("Collaboration WebSocket closed");
        this.attemptReconnect();
      });

      this.ws.addEventListener("error", (error) => {
        console.error("Collaboration WebSocket error:", error);
      });
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      this.attemptReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // Send cursor position
  sendCursorPosition(position: number): void {
    this.send({
      type: "cursor",
      userId: this.userId,
      username: this.username,
      fileId: this.fileId,
      data: { position },
      timestamp: Date.now(),
    });
  }

  // Send edit operation
  sendEdit(edit: any): void {
    this.send({
      type: "edit",
      userId: this.userId,
      username: this.username,
      fileId: this.fileId,
      data: edit,
      timestamp: Date.now(),
    });
  }

  // Request current presence
  requestPresence(): void {
    this.send({
      type: "presence",
      userId: this.userId,
      username: this.username,
      fileId: this.fileId,
      timestamp: Date.now(),
    });
  }

  // Subscribe to messages
  onMessage(handler: CollaborationEventHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  // Subscribe to presence updates
  onPresence(handler: PresenceEventHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  private send(message: CollaborationMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(message: CollaborationMessage): void {
    if (message.type === "presence" && message.data) {
      // Notify presence handlers
      this.presenceHandlers.forEach((handler) => handler(message.data));
    } else {
      // Notify message handlers
      this.messageHandlers.forEach((handler) => handler(message));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnection attempts reached");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  private getWebSocketUrl(): string {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8787";
    const wsUrl = apiUrl.replace(/^http/, "ws");
    return `${wsUrl}/collaboration?fileId=${this.fileId}&userId=${this.userId}&username=${encodeURIComponent(this.username)}`;
  }
}

// Helper hook for React components
export function useCollaboration(fileId: string, userId: string, username: string) {
  const [client] = useState(() => new CollaborationClient(fileId, userId, username));
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  useEffect(() => {
    client.connect();
    client.onPresence(setPresence);
    client.requestPresence();

    return () => client.disconnect();
  }, [client]);

  return { client, presence };
}
