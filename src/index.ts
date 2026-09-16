export interface LinkOptions {
  documents?: boolean;
  repository?: string;
}

export interface MarkdownOptions {
  tagFields?: string[];
  manifests?: boolean;
  generatedDir?: string;
  patterns: string[];
  stylesheet?: string;
  root?: string;
  presentation?: string;
  links?: LinkOptions;
}
