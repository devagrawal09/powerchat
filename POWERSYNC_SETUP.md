# PowerSync Service Setup

## Prerequisites

- Neon database with logical replication enabled
- PowerSync Service instance (Cloud or Self-hosted)

## 1. Enable Logical Replication in Neon Console

1. Go to your Neon project settings
2. Navigate to "Logical Replication"
3. Click "Enable"

## 2. Configure PowerSync Service Connection

### Connection String

Use the `powersync_role` credentials:

```
postgresql://powersync_role:powersync_secure_2025@ep-morning-feather-aew5b16o-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Publication

```
powersync
```

## 3. Define Sync Rules

Add these sync rules to your PowerSync Service configuration to filter data by user membership:

```yaml
# Sync rules for PowerChat
bucket_definitions:
  user_channels:
    parameters:
      - select: "SELECT id as user_id FROM users WHERE id = token_parameters.user_id"

    data:
      # Channels where user is a member
      - SELECT * FROM channels
        WHERE EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.channel_id = channels.id
        AND cm.member_type = 'user'
        AND cm.member_id = bucket.user_id
        )

      # Channel members for user's channels
      - SELECT * FROM channel_members
        WHERE channel_id IN (
        SELECT channel_id FROM channel_members
        WHERE member_type = 'user' AND member_id = bucket.user_id
        )

      # Messages in user's channels
      - SELECT * FROM messages
        WHERE channel_id IN (
        SELECT channel_id FROM channel_members
        WHERE member_type = 'user' AND member_id = bucket.user_id
        )

      # Agents in user's channels
      - SELECT DISTINCT a.* FROM agents a
        JOIN channel_members cm ON cm.member_id = a.id AND cm.member_type = 'agent'
        WHERE cm.channel_id IN (
        SELECT channel_id FROM channel_members
        WHERE member_type = 'user' AND member_id = bucket.user_id
        )

      # Message mentions
      - SELECT mm.* FROM message_mentions mm
        WHERE mm.message_id IN (
        SELECT id FROM messages
        WHERE channel_id IN (
        SELECT channel_id FROM channel_members
        WHERE member_type = 'user' AND member_id = bucket.user_id
        )
        )

      # User records
      - SELECT * FROM users WHERE id = bucket.user_id
```

## 4. JWT Secret

The PowerSync Service must be configured with the same JWT secret as your app's `POWERSYNC_JWT_SECRET` environment variable.

The JWT payload format is:

```json
{
  "sub": "user-uuid",
  "iat": 1234567890,
  "exp": 1234568790
}
```

Algorithm: `HS256`

## 5. Test Connection

Once configured:

1. Start your PowerChat app
2. Open browser console
3. Create a channel
4. Check PowerSync logs to confirm sync is working

## Notes

- Sync rules ensure each user only syncs channels they're members of
- JWT `sub` claim contains the anonymous `user_id` from the cookie
- Token TTL is 15 minutes; client will auto-refresh
