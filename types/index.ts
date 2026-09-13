export type TreeItem = {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
};

export type Branch = {
  name: string;
  commit: { sha: string };
  protected?: boolean;
};

export type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
};

export function buildFileTree(items: TreeItem[]): FileNode[] {
  const root: FileNode[] = [];
  const map: Record<string, FileNode> = {};

  const blobs = items.filter((i) => i.type === "blob");

  for (const item of blobs) {
    const parts = item.path.split("/");
    let currentPath = "";
    let currentLevel = root;

    parts.forEach((part, idx) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = idx === parts.length - 1;

      let node = map[currentPath];
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isFile ? "file" : "folder",
          children: isFile ? undefined : [],
        };
        map[currentPath] = node;
        currentLevel.push(node);
      }
      if (!isFile) {
        currentLevel = node.children!;
      }
    });
  }

  const sortRec = (nodes: FileNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => n.children && sortRec(n.children));
  };
  sortRec(root);

  return root;
}
