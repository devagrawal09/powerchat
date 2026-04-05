import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { MentionAutocomplete } from "./index";

const options = [
  { type: "user" as const, id: "user1", name: "alice" },
  {
    type: "agent" as const,
    id: "00000000-0000-0000-0000-000000000001",
    name: "Assistant",
  },
];

describe("MentionAutocomplete", () => {
  it("does not render when isOpen is false", () => {
    render(() => (
      <MentionAutocomplete
        options={options}
        isOpen={false}
        activeIndex={0}
        disabledAgents={false}
        onSelect={vi.fn()}
        onActiveIndexChange={vi.fn()}
      />
    ));

    expect(screen.queryByText("@Assistant")).not.toBeInTheDocument();
  });

  it("renders provided options when open", () => {
    render(() => (
      <MentionAutocomplete
        options={[options[1]]}
        isOpen={true}
        activeIndex={0}
        disabledAgents={false}
        onSelect={vi.fn()}
        onActiveIndexChange={vi.fn()}
      />
    ));

    expect(screen.getByText("@Assistant")).toBeInTheDocument();
    expect(screen.queryByText("@alice")).not.toBeInTheDocument();
  });

  it("calls onSelect when option is clicked", () => {
    const onSelect = vi.fn();

    render(() => (
      <MentionAutocomplete
        options={options}
        isOpen={true}
        activeIndex={0}
        disabledAgents={false}
        onSelect={onSelect}
        onActiveIndexChange={vi.fn()}
      />
    ));

    fireEvent.mouseDown(screen.getByText("@Assistant").closest("button")!);

    expect(onSelect).toHaveBeenCalledWith(options[1]);
  });

  it("calls onActiveIndexChange on hover", () => {
    const onActiveIndexChange = vi.fn();

    render(() => (
      <MentionAutocomplete
        options={options}
        isOpen={true}
        activeIndex={0}
        disabledAgents={false}
        onSelect={vi.fn()}
        onActiveIndexChange={onActiveIndexChange}
      />
    ));

    fireEvent.mouseEnter(screen.getByText("@alice").closest("button")!);

    expect(onActiveIndexChange).toHaveBeenCalled();
  });

  it("highlights active index", () => {
    render(() => (
      <MentionAutocomplete
        options={options}
        isOpen={true}
        activeIndex={0}
        disabledAgents={false}
        onSelect={vi.fn()}
        onActiveIndexChange={vi.fn()}
      />
    ));

    expect(screen.getByText("@alice").closest("button")?.classList.contains("bg-blue-50")).toBe(true);
  });
});
