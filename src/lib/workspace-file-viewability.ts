export const MAX_WORKSPACE_TEXT_FILE_BYTES = 256 * 1024;

const TEXT_FILE_EXTENSIONS = new Set([
  "c",
  "cc",
  "conf",
  "config",
  "cpp",
  "cs",
  "css",
  "csv",
  "cts",
  "cxx",
  "env",
  "fish",
  "gql",
  "graphql",
  "go",
  "h",
  "hpp",
  "htm",
  "html",
  "ini",
  "java",
  "js",
  "json",
  "jsonc",
  "jsx",
  "kt",
  "less",
  "log",
  "lua",
  "mjs",
  "md",
  "mdx",
  "mts",
  "php",
  "pl",
  "prisma",
  "ps1",
  "py",
  "r",
  "rb",
  "rs",
  "sass",
  "scala",
  "scss",
  "sh",
  "sql",
  "svg",
  "swift",
  "toml",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
  "zsh",
]);

const TEXT_FILE_BASENAMES = new Set([
  ".editorconfig",
  ".gitignore",
  ".gitattributes",
  ".npmrc",
  ".prettierignore",
  ".prettierrc",
  "dockerfile",
  "justfile",
  "license",
  "makefile",
  "readme",
]);

export function isLikelyViewableTextFilePath(relativePath: string) {
  const normalizedPath = relativePath.trim().toLowerCase();
  const fileName = normalizedPath.split("/").filter(Boolean).at(-1) ?? "";

  if (!fileName) {
    return false;
  }

  if (TEXT_FILE_BASENAMES.has(fileName) || fileName.startsWith(".env")) {
    return true;
  }

  const extension = fileName.split(".").at(-1);
  if (!extension || extension === fileName) {
    return false;
  }

  return TEXT_FILE_EXTENSIONS.has(extension);
}

export type WorkspaceFileSelection = {
  path: string;
  name: string;
};
