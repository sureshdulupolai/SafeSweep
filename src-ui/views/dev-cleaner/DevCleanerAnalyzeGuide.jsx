import React from 'react';
import { Download, Terminal } from 'lucide-react';
import { useDevCleanerStore } from '../../store/useDevCleanerStore';

export default function DevCleanerAnalyzeGuide() {
  const { generateDownloads, selectedLanguage } = useDevCleanerStore();
  
  const getLangConfig = () => {
    switch (selectedLanguage) {
      case 'node':
        return {
          filename: 'package.json',
          cmd1: 'mkdir C:\\path\\to\\MasterProject && cd C:\\path\\to\\MasterProject',
          desc1: 'Create a new master project folder',
          cmd2: 'move path\\to\\downloaded\\package.json .',
          desc2: 'Move the downloaded package.json here',
          cmd3: 'npm install',
          desc3: 'Install all consolidated dependencies'
        };
      case 'rust':
        return {
          filename: 'Cargo.toml',
          cmd1: 'cargo new my_master_project',
          desc1: 'Create a new Rust project',
          cmd2: 'move path\\to\\downloaded\\Cargo.toml my_master_project\\Cargo.toml',
          desc2: 'Replace the default Cargo.toml with the downloaded one',
          cmd3: 'cd my_master_project && cargo build',
          desc3: 'Fetch and compile dependencies'
        };
      case 'java':
        return {
          filename: 'dependencies.txt',
          cmd1: 'mkdir C:\\path\\to\\MasterProject',
          desc1: 'Create a new Java project folder',
          cmd2: 'cat dependencies.txt >> build.gradle',
          desc2: 'Add the downloaded dependencies to your Gradle/Maven file',
          cmd3: 'gradle build',
          desc3: 'Resolve all dependencies'
        };
      default:
        // Python
        return {
          filename: 'requirements.txt',
          cmd1: 'python -m venv C:\\path\\to\\your\\MasterEnv',
          desc1: 'Open your terminal and create a new master environment',
          cmd2: 'C:\\path\\to\\your\\MasterEnv\\Scripts\\activate',
          desc2: 'Activate the new environment',
          cmd3: 'pip install -r requirements.txt',
          desc3: 'Install the consolidated packages from the file you downloaded'
        };
    }
  };

  const config = getLangConfig();
  
  return (
    <div className="p-6 bg-brand-card rounded-xl border border-brand-border shadow-lg space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Export & Manual Consolidation Guide</h2>
        <p className="text-sm text-gray-400">
          Instead of running background commands, you are in full control. Download your files and run these commands in your own terminal to create your new environment.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button 
          onClick={generateDownloads}
          className="w-full bg-brand-darkest hover:bg-brand-dark border border-brand-accent text-white px-4 py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-5 h-5 text-brand-accent" />
          Download {config.filename} & Report
        </button>
        <div className="text-xs text-center text-brand-rose/80 font-medium">
          ⚠️ Note: You must download your files first to unlock the final "Proceed to Deletion" button.
        </div>
      </div>

      <div className="bg-black/50 p-4 rounded-lg border border-brand-border/40 font-mono text-sm text-gray-300">
        <div className="flex items-center gap-2 mb-3 text-brand-accent border-b border-brand-border/40 pb-2">
          <Terminal className="w-4 h-4" />
          <span>Manual Commands</span>
        </div>
        <div className="space-y-2">
          <p className="text-gray-500"># 1. {config.desc1}</p>
          <p>{config.cmd1}</p>
          
          <p className="text-gray-500 mt-4"># 2. {config.desc2}</p>
          <p>{config.cmd2}</p>
          
          <p className="text-gray-500 mt-4"># 3. {config.desc3}</p>
          <p>{config.cmd3}</p>
        </div>
      </div>
    </div>
  );
}
