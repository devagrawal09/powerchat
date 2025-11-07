import { writeTransaction } from "~/lib/powersync";

type DeleteChannelProps = {
  channelId: string;
  onDelete?: () => void;
};

export function DeleteChannel(props: DeleteChannelProps) {
  const handleDelete = async () => {
    await writeTransaction(async (tx) => {
      await tx.execute("DELETE FROM channels WHERE id = ?", [props.channelId]);
    });
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
