import * as signalR from '@microsoft/signalr';
import { AuthService } from '../auth.service';
import { getApiUrl } from '../config';

const API_URL = getApiUrl();

const RECONNECT_DELAYS = [0, 1_000, 5_000, 10_000, 30_000];

export class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private _closeCallbacks: Array<() => void> = [];
  private _reconnectedCallbacks: Array<(connectionId?: string) => void> = [];
  private _reconnectingCallbacks: Array<() => void> = [];
  /** Hub userId (Guid) received from Connected event. */
  public hubUserId: string | null = null;
  /**
   * Resolves when the server's `Connected` event arrives (which carries the
   * hub userId). Hoisted to the instance so idempotent connect() calls during
   * Connecting/Reconnecting can await the in-flight handshake instead of
   * returning before hubUserId lands — which would race
   * ensureMultiplayerHandlersRegistered → syncHubUserId and leave the session
   * store's hubUserId null (breaks rejoin replay + ownership checks).
   */
  private _connectedPromise: Promise<void> | null = null;

  constructor() {}

  async connect(token?: string): Promise<void> {
    if (token) {
      AuthService.setToken(token);
    }

    if (!AuthService.getToken()) {
      throw new Error('No token available. Please login first.');
    }

    // Idempotent: if a connection already exists and is alive, reuse it.
    // Building a fresh HubConnection drops every prior `.on(...)` registration,
    // which silently loses all SignalR event handlers (including dice ones).
    // Multiple components (SessionInviteListener, CampaignView, LobbyScreen, etc.)
    // call connect() at startup; without this guard the second call wipes
    // handlers registered against the first connection.
    if (this.connection) {
      const state = this.connection.state;
      if (state === signalR.HubConnectionState.Connected) {
        console.log('[SignalRService] connect() reuse: already Connected');
        return;
      }
      if (
        state === signalR.HubConnectionState.Connecting ||
        state === signalR.HubConnectionState.Reconnecting
      ) {
        // Wait for the in-flight handshake so callers see hubUserId populated
        // before they invoke hub methods or call syncHubUserId().
        console.log(
          '[SignalRService] connect() during',
          state,
          '— awaiting in-flight Connected'
        );
        if (this._connectedPromise) {
          await Promise.race([
            this._connectedPromise,
            new Promise((r) => setTimeout(r, 3000)),
          ]);
        }
        return;
      }
      if (state === signalR.HubConnectionState.Disconnected) {
        // Reuse the existing connection object; restart it to preserve handlers.
        try {
          await this.connection.start();
          console.log('[SignalRService] reused disconnected connection, restarted');
          return;
        } catch (err) {
          console.warn(
            '[SignalRService] restart of disconnected connection failed; rebuilding',
            err
          );
          // Fall through to rebuild path.
        }
      }
    }

    // Clear lifecycle callbacks from previous connection to prevent stacking
    this._closeCallbacks = [];
    this._reconnectedCallbacks = [];
    this._reconnectingCallbacks = [];

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/game`, {
        accessTokenFactory: () => AuthService.getToken() ?? "",
        transport: signalR.HttpTransportType.WebSockets,
        skipNegotiation: true,
      })
      .withAutomaticReconnect(RECONNECT_DELAYS)
      .configureLogging(signalR.LogLevel.Information)
      .build();

    this._connectedPromise = new Promise<void>((resolve) => {
      this.connection!.on('Connected', (data) => {
        console.log('Connected to SignalR:', data);
        if (data?.userId) {
          this.hubUserId = String(data.userId);
        }
        resolve();
      });
    });
    const connectedPromise = this._connectedPromise;

    this.connection.on('Pong', (timestamp) => {
      console.log('Pong received at:', timestamp);
    });

    this.connection.onreconnecting((error) => {
      console.warn('Reconnecting...', error);
      this._reconnectingCallbacks.forEach(cb => cb());
    });

    this.connection.onreconnected((connectionId) => {
      console.log('Reconnected! New ConnectionId:', connectionId);
      this._reconnectedCallbacks.forEach(cb => cb(connectionId ?? undefined));
    });

    this.connection.onclose((error) => {
      console.error('Connection closed:', error);
      this._closeCallbacks.forEach(cb => cb());
    });

    try {
      await this.connection.start();
      await Promise.race([connectedPromise, new Promise(r => setTimeout(r, 3000))]);
      if (this.connection.connectionId) {
        console.log('SignalR Started. ConnectionId:', this.connection.connectionId);
      } else {
        console.log('SignalR Started (connectionId pending)');
      }
    } catch (err: any) {
      console.error('Failed to start SignalR:', err);
      console.error('Error details:', {
        message: err?.message,
        status: err?.statusCode || err?.status,
        response: err?.response,
        stack: err?.stack
      });
      this.connection = null;
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      console.log('SignalR Disconnected');
    }
  }

  async ping(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    await this.connection.invoke('Ping');
  }

  get isConnected(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Connected;
  }

  get isReconnecting(): boolean {
    return this.connection?.state === signalR.HubConnectionState.Reconnecting;
  }

  get connectionId(): string | undefined {
    return this.connection?.connectionId ?? undefined;
  }

  onClose(callback: () => void): void {
    this._closeCallbacks.push(callback);
  }

  onReconnected(callback: (connectionId?: string) => void): void {
    this._reconnectedCallbacks.push(callback);
  }

  onReconnecting(callback: () => void): void {
    this._reconnectingCallbacks.push(callback);
  }

  on(methodName: string, callback: (...args: any[]) => void): void {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    this.connection.on(methodName, callback);
  }

  off(methodName: string, callback?: (...args: any[]) => void): void {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    if (callback) {
      this.connection.off(methodName, callback);
    } else {
      this.connection.off(methodName);
    }
  }

  async invoke(methodName: string, ...args: any[]): Promise<any> {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    return await this.connection.invoke(methodName, ...args);
  }
}

// Singleton
export const signalRService = new SignalRService();
