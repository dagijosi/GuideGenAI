import { useState } from 'react';
import { Save, Bot, Globe, HardDrive } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function Settings() {
  const [lmUrl, setLmUrl] = useState('http://localhost:1234');
  const [model, setModel] = useState('qwen2.5-7b-instruct');
  const [maxTokens, setMaxTokens] = useState('4096');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // TODO: Persist via /v1/settings API
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className='max-w-2xl space-y-6'>
      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Bot className='h-5 w-5 text-brand-500' />
            AI Settings
          </CardTitle>
        </CardHeader>
        <div className='space-y-4'>
          <div>
            <label htmlFor='lm-url' className='mb-1 block text-sm font-medium text-gray-700'>
              LM Studio URL
            </label>
            <input
              id='lm-url'
              type='url'
              value={lmUrl}
              onChange={(e) => setLmUrl(e.target.value)}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
            />
          </div>
          <div>
            <label htmlFor='model' className='mb-1 block text-sm font-medium text-gray-700'>
              Model
            </label>
            <input
              id='model'
              type='text'
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
              placeholder='qwen2.5-7b-instruct'
            />
          </div>
          <div>
            <label htmlFor='max-tokens' className='mb-1 block text-sm font-medium text-gray-700'>
              Max Tokens
            </label>
            <input
              id='max-tokens'
              type='number'
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
            />
          </div>
        </div>
      </Card>

      {/* Browser Settings */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Globe className='h-5 w-5 text-brand-500' />
            Browser Settings
          </CardTitle>
        </CardHeader>
        <div className='space-y-4'>
          <div>
            <label htmlFor='browser' className='mb-1 block text-sm font-medium text-gray-700'>
              Browser Engine
            </label>
            <select
              id='browser'
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
            >
              <option value='chromium'>Chromium (Recommended)</option>
              <option value='firefox'>Firefox</option>
              <option value='webkit'>WebKit</option>
            </select>
          </div>
          <label className='flex items-center gap-2 text-sm text-gray-700'>
            <input type='checkbox' defaultChecked />
            Headless mode
          </label>
        </div>
      </Card>

      {/* Storage Settings */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <HardDrive className='h-5 w-5 text-brand-500' />
            Storage
          </CardTitle>
        </CardHeader>
        <div>
          <label htmlFor='storage-path' className='mb-1 block text-sm font-medium text-gray-700'>
            Storage Path
          </label>
          <input
            id='storage-path'
            type='text'
            defaultValue='./storage'
            className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
          />
        </div>
      </Card>

      <Button onClick={handleSave}>
        <Save className='h-4 w-4' />
        {saved ? 'Saved!' : 'Save Settings'}
      </Button>
    </div>
  );
}
