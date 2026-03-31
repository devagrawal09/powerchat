import { createIsoMutation, createIsoQuery } from "~/lib/isomorphic";

export const channelQuery = createIsoQuery(
  () => `
    SELECT c.* FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id
    WHERE cm.member_type = 'user' AND cm.member_id = auth.user_id()
  `,
);

export const createMessageMutation = createIsoMutation(
  () => `
    INSERT INTO messages (id, channel_id, author_type, author_id, content, mentioned_agent, created_at)
    VALUES (parameter('message_id'), parameter('channel_id'), 'user', auth.user_id(), parameter('content'), parameter('mentioned_agent'), parameter('created_at'))
  `,
);
