// File: backend/src/platforms/interfaces/PlatformInterface.ts
// Platform abstraction interface for multi-platform support

export interface PlatformConfig {
  enabled: boolean;
  accessToken?: string;
  webhookSecret?: string;
  businessAccountId?: string;
  pageId?: string;
  botToken?: string;
  phoneNumberId?: string;
  embedCode?: string;
}

export interface PlatformMessage {
  id: string;
  content: string;
  senderId: string;
  timestamp: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  metadata?: Record<string, any>;
}

export interface PlatformWebhookData {
  platform: string;
  companyId: string;
  messages: PlatformMessage[];
  rawData: any;
}

export interface MessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
  timestamp: string;
}

export interface PlatformProvider {
  name: string;
  
  // Core methods
  initialize(config: PlatformConfig): Promise<void>;
  sendMessage(to: string, message: string, companyId: string): Promise<MessageResponse>;
  handleWebhook(data: any): Promise<PlatformWebhookData | null>;
  validateWebhook(signature: string, body: string, secret: string): boolean;
  
  // Platform capabilities
  supportedFeatures: PlatformFeature[];
  isInitialized(): boolean;
  getStats(): PlatformStats;
}

export interface PlatformFeature {
  name: string;
  enabled: boolean;
  description: string;
}

export interface PlatformStats {
  messagesSent: number;
  messagesReceived: number;
  lastActivity: string;
  errors: number;
  uptime: number;
}
