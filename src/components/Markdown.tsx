import Markdown from "solid-marked/component";

export function RenderMarkdown(props: { children: string }) {
  return (
    <Markdown
      builtins={{
        Root(props) {
          return <div class="prose prose-sm max-w-none">{props.children}</div>;
        },
        Blockquote(props) {
          return (
            <blockquote class="border-l-4 border-slate-300 pl-4 italic  my-4">
              {props.children}
            </blockquote>
          );
        },
        Paragraph(props) {
          return <p class="leading-relaxed">{props.children}</p>;
        },
        Heading(props) {
          const headingClasses = {
            1: "text-2xl font-bold  mb-4 mt-6",
            2: "text-xl font-semibold  mb-3 mt-5",
            3: "text-lg font-medium  mb-2 mt-4",
            4: "text-base font-medium  mb-2 mt-3",
            5: "text-sm font-medium  mb-1 mt-2",
            6: "text-xs font-medium  mb-1 mt-2",
          };
          return <p class={headingClasses[props.depth]}>{props.children}</p>;
        },
        List(props) {
          return <ul class="list-disc list-outside pl-5">{props.children}</ul>;
        },
        ListItem(props) {
          return <li class="">{props.children}</li>;
        },
        Table(props) {
          return (
            <div class="overflow-x-auto my-4">
              <table class="min-w-full border border-slate-200 rounded-lg">
                {props.children}
              </table>
            </div>
          );
        },
        TableRow(props) {
          return <tr class="border-b border-slate-200">{props.children}</tr>;
        },
        TableCell(props) {
          return <td class="px-3 py-2 text-sm ">{props.children}</td>;
        },
        Code(props) {
          return (
            <code class="bg-slate-100  px-1 py-0.5 rounded text-sm font-mono">
              {props.children}
            </code>
          );
        },
        Emphasis(props) {
          return <em class="italic ">{props.children}</em>;
        },
        Strong(props) {
          return <strong class="font-semibold ">{props.children}</strong>;
        },
        InlineCode(props) {
          return (
            <code class="bg-[#00C86F]/20 text-[#00C86F] px-1 py-0.5 rounded text-sm font-mono">
              {props.children}
            </code>
          );
        },
      }}
    >
      {props.children}
    </Markdown>
  );
}
