import { For, Show } from "solid-js";

export type MentionOption = {
  type: "user" | "agent";
  id: string;
  name: string;
};

type MentionAutocompleteProps = {
  options: MentionOption[];
  isOpen: boolean;
  activeIndex: number;
  disabledAgents: boolean;
  onSelect: (option: MentionOption) => void;
  onActiveIndexChange: (index: number) => void;
};

export function MentionAutocomplete(props: MentionAutocompleteProps) {
  return (
    <Show when={props.isOpen && props.options.length > 0}>
      <div class="absolute bottom-full left-0 right-0 mb-2 max-h-56 overflow-auto bg-white border border-gray-200 rounded shadow z-50">
        <For each={props.options}>
          {(option, idx) => {
            const isDisabled = () =>
              option.type === "agent" && props.disabledAgents;
            const isActive = () => idx() === props.activeIndex;

            return (
              <button
                type="button"
                class={`w-full text-left px-3 py-2 ${
                  isDisabled()
                    ? "opacity-40 cursor-not-allowed bg-gray-50"
                    : isActive()
                      ? "bg-blue-50"
                      : "bg-white hover:bg-gray-50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!isDisabled()) {
                    props.onSelect(option);
                  }
                }}
                onMouseEnter={() => {
                  if (!isDisabled()) {
                    props.onActiveIndexChange(idx());
                  }
                }}
              >
                <span
                  class={`text-xs uppercase mr-2 ${
                    option.type === "agent"
                      ? "text-purple-600 font-semibold"
                      : "text-gray-500"
                  }`}
                >
                  {option.type === "agent" ? "agent" : option.type}
                </span>
                <span class={isDisabled() ? "text-gray-400" : "text-gray-900"}>
                  @{option.name}
                </span>
                <Show when={isDisabled()}>
                  <span class="text-xs text-gray-400 ml-2">(limit 1 per message)</span>
                </Show>
              </button>
            );
          }}
        </For>
      </div>
    </Show>
  );
}
