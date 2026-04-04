import { eq } from "drizzle-orm";
import { channels, clientDb } from "~/db/client";

type DeleteChannelProps = {
  channelId: string;
  onDelete?: () => void;
};

export function DeleteChannel(props: DeleteChannelProps) {
  const handleDelete = async () => {
    await clientDb.delete(channels).where(eq(channels.id, props.channelId));
    props.onDelete?.();
  };

  return (
    <button
      type="button"
      class="ml-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleDelete();
      }}
      aria-label="Delete channel"
    >
      ×
    </button>
  );
}
