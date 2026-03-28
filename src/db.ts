import { createIsoQuery } from "~/lib/isomorphic";

export const channelQuery = createIsoQuery(
  () => `
    SELECT c.* FROM channels c
    JOIN channel_members cm ON cm.channel_id = c.id
    WHERE cm.member_type = 'user' AND cm.member_id = auth.user_id()
  `,
);
