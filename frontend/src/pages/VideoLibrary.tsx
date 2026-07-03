import { Video } from 'lucide-react';
import { Card } from '../components/ui/Card';

export default function VideoLibrary() {
  return (
    <Card>
      <div className='flex flex-col items-center justify-center py-16 text-center'>
        <Video className='mb-4 h-16 w-16 text-gray-300' />
        <h3 className='text-lg font-semibold text-gray-600'>Video Library</h3>
        <p className='mt-2 max-w-sm text-sm text-gray-400'>
          Video recordings of crawl sessions and workflow demonstrations will appear here once
          generated. Enable video recording when creating a project.
        </p>
      </div>
    </Card>
  );
}
