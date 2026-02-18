import { channelsCollection, ensureTanStackDbReady } from "~/lib/tanstack-db";

type DeleteChannelProps = {
  channelId: string;
  onDelete?: () => void;
};

export function DeleteChannel(props: DeleteChannelProps) {
  const handleDelete = async () => {
    await ensureTanStackDbReady();
    await channelsCollection.delete(props.channelId).isPersisted.promise;
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
