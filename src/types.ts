export interface GeneratorConfig {
  packageName: string;
  targetPackage: string;
  className: string;
  loggerTag: string;
  moduleName: string;
  moduleDesc: string;
  minXposedVersion: number;
  hookExample: 'statusbar' | 'volume' | 'simple' | 'universal_island' | 'hyper_island';
}

export interface GeneratedFile {
  name: string;
  path: string;
  language: 'kotlin' | 'xml' | 'plaintext' | 'gradle' | 'markdown';
  content: string;
  description: string;
}
