import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlusIcon } from '@heroicons/react/24/outline';

import { TaskProvider } from './context/TaskContext';
import { TagProvider } from './context/TagContext';
import { ListProvider } from './context/ListContext';

import GlobalTaskForm from './features/tasks/components/GlobalTaskForm';
import TaskBoard from './features/lists/components/TaskBoard';
import VoiceChanger from './features/voice/components/VoiceChanger';

const TABS = [
  { id: 'tasks', label: 'المهام', emoji: '📋' },
  { id: 'voice', label: 'مغير الصوت', emoji: '🎙️' },
];

function App() {
  const [showInput, setShowInput] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  return (
    <TaskProvider>
      <TagProvider>
        <ListProvider>
          <div className="App min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex flex-col items-center py-12 px-4" data-testid="app">
            <div className="w-full max-w-6xl">

              {/* Header */}
              <motion.div
                className="mb-6 bg-white rounded-2xl shadow-soft p-6"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                data-testid="app-header"
              >
                <div className="flex justify-between items-center mb-4">
                  <h1 className="text-3xl font-bold text-neutral-800 tracking-tight">Task Dashboard</h1>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-colors
                        ${activeTab === tab.id
                          ? 'bg-primary-500 text-white'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
                    >
                      <span>{tab.emoji}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {activeTab === 'tasks' && (
                    showInput ? (
                      <motion.div
                        key="form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                        data-testid="task-form-container"
                      >
                        <GlobalTaskForm onCancel={() => setShowInput(false)} />
                      </motion.div>
                    ) : (
                      <motion.button
                        key="add-btn"
                        className="flex items-center justify-center w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium transition-colors"
                        onClick={() => setShowInput(true)}
                        whileTap={{ scale: 0.97 }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        data-testid="show-task-form-button"
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Add New Task
                      </motion.button>
                    )
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Content */}
              <AnimatePresence mode="wait">
                {activeTab === 'tasks' && (
                  <motion.div
                    key="tasks"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <TaskBoard />
                  </motion.div>
                )}

                {activeTab === 'voice' && (
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className="max-w-lg mx-auto"
                  >
                    <VoiceChanger />
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </ListProvider>
      </TagProvider>
    </TaskProvider>
  );
}

export default App;
