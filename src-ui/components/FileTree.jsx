import React, { useState, useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Folder, FolderOpen, File, ShieldAlert, CheckSquare, Square, MinusSquare } from 'lucide-react';

export default function FileTree({ files, scanPath, selectedPaths, onToggleSelection }) {
  const [expandedFolders, setExpandedFolders] = useState({});

  // 1. Build a nested tree structure out of flat path entries relative to the target scanPath
  const treeData = useMemo(() => {
    const root = { name: 'root', path: 'root', isDir: true, children: {} };
    const normalizedScanPath = scanPath ? scanPath.replace(/[\\/]+/g, '\\').replace(/\\$/, '') : '';

    files.forEach((file) => {
      const normalizedFilePath = file.path.replace(/[\\/]+/g, '\\');
      let relativePath = normalizedFilePath;
      
      // Compute relative path to avoid C:\Users\user nesting at the root level of the folder tree
      if (normalizedScanPath && normalizedFilePath.toLowerCase().startsWith(normalizedScanPath.toLowerCase())) {
        relativePath = normalizedFilePath.substring(normalizedScanPath.length).replace(/^\\/, '');
      }

      const parts = relativePath.split(/[\\/]/);
      let current = root;

      parts.forEach((part, index) => {
        if (!part) return;

        const isLast = index === parts.length - 1;
        let currentPath = '';
        
        if (normalizedScanPath && normalizedFilePath.toLowerCase().startsWith(normalizedScanPath.toLowerCase())) {
          const subParts = parts.slice(0, index + 1);
          currentPath = normalizedScanPath + '\\' + subParts.join('\\');
        } else {
          currentPath = parts.slice(0, index + 1).join('\\');
        }

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isDir: !isLast,
            size: isLast ? file.size : 0,
            risk: isLast ? file.risk : 'SAFE',
            children: {}
          };
        } else if (!isLast) {
          current.children[part].isDir = true;
        }

        if (isLast) {
          current.children[part].size = file.size;
          current.children[part].risk = file.risk;
        }

        if (!isLast) {
          current.children[part].size += file.size;
        }

        current = current.children[part];
      });
    });

    return root;
  }, [files, scanPath]);

  // 2. Recursively flatten the tree into visible nodes based on active expanded folder parameters
  const flatNodes = useMemo(() => {
    const list = [];

    const traverse = (node, depth = 0) => {
      if (node.path !== 'root') {
        list.push({
          name: node.name,
          path: node.path,
          isDir: node.isDir,
          size: node.size,
          risk: node.risk,
          depth
        });
      }

      if (node.path === 'root' || expandedFolders[node.path]) {
        const sortedChildren = Object.values(node.children).sort((a, b) => {
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
        });

        sortedChildren.forEach((child) => traverse(child, depth + 1));
      }
    };

    traverse(treeData);
    return list;
  }, [treeData, expandedFolders]);

  const toggleFolder = (path) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const getCheckState = (node) => {
    if (node.isDir) {
      const subfiles = files.filter(f => f.path.startsWith(node.path + '\\') || f.path === node.path);
      const toggleableFiles = subfiles.filter(f => f.risk !== 'CRITICAL' && f.risk !== 'HIGH');
      if (toggleableFiles.length === 0) return 'unchecked';

      const selectedSubfiles = toggleableFiles.filter(f => selectedPaths.includes(f.path));
      if (selectedSubfiles.length === toggleableFiles.length) return 'checked';
      if (selectedSubfiles.length > 0) return 'indeterminate';
      return 'unchecked';
    }

    return selectedPaths.includes(node.path) ? 'checked' : 'unchecked';
  };

  const handleCheckboxClick = (node) => {
    const state = getCheckState(node);
    
    if (node.isDir) {
      const subfiles = files.filter(f => f.path.startsWith(node.path + '\\') || f.path === node.path);
      // Skip critical system files completely from select/deselect toggles
      const toggleableFiles = subfiles.filter(f => f.risk !== 'CRITICAL' && f.risk !== 'HIGH');
      
      if (toggleableFiles.length === 0) return;
      
      if (state === 'checked') {
        onToggleSelection(toggleableFiles.map(f => f.path), false);
      } else {
        onToggleSelection(toggleableFiles.map(f => f.path), true);
      }
    } else {
      if (node.risk === 'CRITICAL' || node.risk === 'HIGH') return;
      onToggleSelection([node.path], state !== 'checked');
    }
  };

  // Format bytes helper
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Virtual Row Renderer
  const Row = ({ index, style }) => {
    const node = flatNodes[index];
    const checkState = getCheckState(node);
    const isExpanded = expandedFolders[node.path];
    const isProtected = node.risk === 'CRITICAL' || node.risk === 'HIGH';

    return (
      <div 
        style={style} 
        className={`flex items-center gap-2 hover:bg-brand-card/40 px-3 py-1 rounded transition-colors text-xs font-mono select-none ${
          isProtected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={() => {
          if (node.isDir) {
            toggleFolder(node.path);
          } else {
            if (!isProtected) handleCheckboxClick(node);
          }
        }}
      >
        {/* Indent Spacer */}
        <div style={{ width: `${(node.depth - 1) * 16}px` }} className="flex-shrink-0" />

        {/* Checkbox Icon */}
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (isProtected) return;
            handleCheckboxClick(node);
          }}
          className={`text-gray-400 hover:text-brand-accent transition-colors mr-1 ${
            isProtected ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {checkState === 'checked' && <CheckSquare className="h-4 w-4 text-brand-accent" />}
          {checkState === 'unchecked' && <Square className="h-4 w-4" />}
          {checkState === 'indeterminate' && <MinusSquare className="h-4 w-4 text-brand-amber" />}
        </div>

        {/* Folder/File Type Icon */}
        <div className="text-gray-400">
          {node.isDir ? (
            isExpanded ? <FolderOpen className="h-4 w-4 text-brand-accent" /> : <Folder className="h-4 w-4 text-brand-accent" />
          ) : (
            <File className="h-4 w-4" />
          )}
        </div>

        {/* Name Label */}
        <span className={`flex-1 truncate ${isProtected ? 'text-gray-500 line-through' : 'text-gray-300'}`}>{node.name}</span>

        {/* Danger Badges for High/Critical risk files */}
        {node.risk === 'CRITICAL' && (
          <span className="bg-brand-rose/10 border border-brand-rose/20 text-brand-rose text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5 font-sans font-semibold">
            <ShieldAlert className="h-3 w-3" />
            <span>SHIELDED</span>
          </span>
        )}
        
        {node.risk === 'HIGH' && (
          <span className="bg-brand-amber/10 border border-brand-amber/20 text-brand-amber text-[9px] px-1 py-0.5 rounded font-sans font-semibold">
            SHIELDED
          </span>
        )}

        {/* Size Label */}
        <span className="text-gray-500 font-sans">{formatBytes(node.size)}</span>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-brand-darkest border border-brand-border rounded-xl p-3 min-h-[300px] flex flex-col">
      {flatNodes.length === 0 ? (
        <div className="flex-grow flex flex-col items-center justify-center text-gray-500 gap-2 py-10">
          <span>No scanned files to view.</span>
        </div>
      ) : (
        <div className="flex-grow h-[350px]">
          <List
            height={350}
            itemCount={flatNodes.length}
            itemSize={28}
            width="100%"
          >
            {Row}
          </List>
        </div>
      )}
    </div>
  );
}
