export default function Home() {
  return (
    <div class="flex items-center justify-center h-full text-gray-400">
      <div class="text-center max-w-sm">
        {/* Chat bubble icon */}
        <svg
          class="mx-auto mb-4 text-gray-300"
          width="56"
          height="56"
          viewBox="0 0 56 56"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M14 42V36H10C7.79 36 6 34.21 6 32V12C6 9.79 7.79 8 10 8H46C48.21 8 50 9.79 50 12V32C50 34.21 48.21 36 46 36H26L14 42Z" />
          <line x1="18" y1="18" x2="38" y2="18" />
          <line x1="18" y1="24" x2="32" y2="24" />
        </svg>
        <h2 class="text-xl font-semibold text-gray-700 mb-2">Welcome to PowerChat</h2>
        <p class="text-sm text-gray-400">
          Select a channel from the sidebar or click the <span class="font-medium text-gray-500">+</span> button to create one.
        </p>
      </div>
    </div>
  );
}
