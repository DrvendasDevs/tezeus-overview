# Evolution API Migration Implementation

## Overview

This document details the migration from Supabase Edge Functions to an external Provisioner API for managing Evolution WhatsApp instances. The implementation creates a decoupled architecture where the frontend communicates with an external service (n8n/microservice) that handles Evolution API operations.

## Architecture Changes

### Before (Supabase Edge Functions)
```
Frontend → Supabase Edge Functions → Evolution API → Webhook → Supabase Edge Functions → Database
```

### After (External Provisioner)
```
Frontend → Provisioner API → Evolution API → Webhook → Provisioner API → Database/S3
```

## Implementation Status

### ✅ Completed

1. **Database Migration**
   - Added unique constraints to `connections` table
   - Created indexes for performance
   - Ensured default workspace limits

2. **Frontend Refactoring**
   - Created `EvolutionProvider` service class
   - Updated `Conexoes` component to use new provider
   - Added proper TypeScript interfaces
   - Enhanced UI with connection actions and QR refresh

3. **Type Definitions**
   - Centralized types in `src/types/evolution.ts`
   - Consistent interfaces across the application
   - Proper error handling patterns

### 🔄 Pending External Implementation

The following components need to be implemented in the external Provisioner API:

## External Provisioner API Specification

### Base URL Configuration
```env
PROVISIONER_BASE_URL=https://your-provisioner-api.com/api/v1
```

### Required Endpoints

#### 1. List Connections
```
GET /connections?workspaceId={id}
Response: {
  success: boolean,
  data: {
    connections: Connection[],
    quota: { used: number, limit: number }
  }
}
```

#### 2. Create Connection
```
POST /connections
Body: {
  instanceName: string,
  historyRecovery: 'none'|'week'|'month'|'quarter',
  workspaceId: string
}
Response: {
  success: boolean,
  data: Connection
}
```

#### 3. Get Connection Status
```
GET /connections/{id}/status
Response: {
  success: boolean,
  data: Connection
}
```

#### 4. Get QR Code
```
GET /connections/{id}/qr
Response: {
  success: boolean,
  data: { qr_code: string }
}
```

#### 5. Test Connectivity
```
GET /test
Response: {
  success: boolean,
  data: {
    success: boolean,
    tests: Array<{ test: string, passed: boolean, message?: string }>,
    summary: { passed: number, total: number }
  }
}
```

#### 6. Connection Actions
```
POST /connections/{id}/reconnect
POST /connections/{id}/pause
DELETE /connections/{id}
```

#### 7. Get Logs
```
GET /logs?connectionId={id}&limit={n}
Response: {
  success: boolean,
  data: {
    logs: Array<{
      id: string,
      level: string,
      message: string,
      event_type: string,
      created_at: string,
      metadata?: any
    }>
  }
}
```

### Webhook Handler

The Provisioner must also provide a public webhook endpoint to receive Evolution events:

```
POST /webhook/evolution?token={EVOLUTION_WEBHOOK_SECRET}
```

This endpoint should:
1. Validate the webhook secret
2. Process Evolution events (QR codes, status changes, messages)
3. Update the database accordingly
4. Store media files in S3-compatible storage

## Environment Variables for Provisioner

```env
# Evolution API
EVOLUTION_API_BASE_URL=https://your-evolution-api.com
EVOLUTION_API_KEY=your-evolution-key
EVOLUTION_WEBHOOK_SECRET=your-strong-webhook-secret

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# S3 Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=your-bucket
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key

# Webhook
WEBHOOK_ENDPOINT_URL=https://your-provisioner.com/webhook/evolution
```

## Security Considerations

1. **Frontend Security**
   - Only `PROVISIONER_BASE_URL` is exposed to frontend
   - All sensitive credentials stay in the Provisioner
   - Authentication can be added to Provisioner endpoints

2. **Webhook Security**
   - Webhook secret validation
   - IP allowlisting (optional)
   - Rate limiting on webhook endpoint

3. **Database Security**
   - RLS policies by workspace
   - Connection secrets isolated in separate table
   - Audit logging for all operations

## Testing Strategy

1. **Unit Tests**: Test EvolutionProvider methods
2. **Integration Tests**: Test with mock Provisioner API
3. **E2E Tests**: Test complete connection flow
4. **Load Tests**: Test webhook endpoint performance

## Migration Steps

1. ✅ Update frontend code (completed)
2. 🔄 Implement external Provisioner API
3. 🔄 Configure environment variables
4. 🔄 Set up webhook endpoint
5. 🔄 Test complete flow
6. 🔄 Deploy and monitor

## Rollback Plan

If issues arise, the system can temporarily fallback to Supabase Edge Functions by:
1. Reverting `EvolutionProvider` to use `supabase.functions.invoke`
2. Updating `PROVISIONER_BASE_URL` to point to Supabase Functions
3. No database changes needed (backward compatible)

## Benefits of New Architecture

1. **Decoupling**: No dependency on Supabase Edge Functions
2. **Flexibility**: Can use any backend technology (n8n, Node.js, Python, etc.)
3. **Scalability**: External service can be scaled independently
4. **Security**: Secrets isolated from frontend
5. **Monitoring**: Better observability with dedicated service
6. **Storage**: Direct S3 integration for media files

## Next Steps

1. Implement the Provisioner API using preferred technology (n8n recommended)
2. Configure environment variables
3. Set up webhook handling
4. Test connection creation and QR code flow
5. Implement remaining actions (pause, reconnect, delete)
6. Add comprehensive logging and monitoring