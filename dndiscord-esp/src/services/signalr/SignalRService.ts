import * as signalR from '@microsoft/signalr';
import { AuthService } from '../auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5054';

export class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private token: string | null = null;

  constructor() {}

  async connect(token?: string): Promise<void> {
    // Use provided token or get from AuthService
    this.token = token || AuthService.getToken();

    if (!this.token) {
      throw new Error('No token available. Please login first.');
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/hubs/game`, {
        accessTokenFactory: () => this.token!
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Handlers de base
    this.connection.on('Connected', (data) => {
      console.log('Connected to SignalR:', data);
    });

    this.connection.on('Pong', (timestamp) => {
      console.log('Pong received at:', timestamp);
    });

    this.connection.onreconnecting((error) => {
      console.warn('Reconnecting...', error);
    });

    this.connection.onreconnected((connectionId) => {
      console.log('Reconnected! New ConnectionId:', connectionId);
    });

    this.connection.onclose((error) => {
      console.error('Connection closed:', error);
    });

    try {
      await this.connection.start();
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
      // Clean up on failure
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

  get connectionId(): string | undefined {
    return this.connection?.connectionId ?? undefined;
  }

  /**
   * Register a handler for a specific hub method
   */
  on(methodName: string, callback: (...args: any[]) => void): void {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    this.connection.on(methodName, callback);
  }

  /**
   * Remove a handler for a specific hub method
   */
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

  /**
   * Invoke a hub method
   */
  async invoke(methodName: string, ...args: any[]): Promise<any> {
    if (!this.connection) {
      throw new Error('Not connected');
    }
    return await this.connection.invoke(methodName, ...args);
  }
}

// Singleton
export const signalRService = new SignalRService();
