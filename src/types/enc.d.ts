declare module '*.enc' {
  const content: {
    version: number;
    cipher: string;
  };
  export default content;
}
