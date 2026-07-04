import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import { useCreateProject } from '../../hooks/useProjects';
import type { CreateProjectPayload } from '../../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Must be a valid URL'),
  username: z.string().optional(),
  password: z.string().optional(),
  maxDepth: z.coerce.number().min(1).max(20).default(5),
  maxPages: z.coerce.number().min(1).max(500).default(100),
  includeScreenshots: z.boolean().default(true),
  includeVideo: z.boolean().default(false),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  onClose: () => void;
}

export default function CreateProjectModal({ onClose }: Props) {
  const { mutateAsync, isPending } = useCreateProject();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    await mutateAsync(data as CreateProjectPayload);
    onClose();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl'>
        <div className='mb-6 flex items-center justify-between'>
          <h2 className='text-lg font-semibold text-gray-900'>New Documentation Project</h2>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1 text-gray-400 hover:bg-gray-100'
            aria-label='Close modal'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          <div>
            <label htmlFor='name' className='mb-1 block text-sm font-medium text-gray-700'>
              Project Name
            </label>
            <input
              id='name'
              type='text'
              {...register('name')}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
              placeholder='My CRM Documentation'
            />
            {errors.name && <p className='mt-1 text-xs text-red-500'>{errors.name.message}</p>}
          </div>

          <div>
            <label htmlFor='url' className='mb-1 block text-sm font-medium text-gray-700'>
              Website URL
            </label>
            <input
              id='url'
              type='url'
              {...register('url')}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
              placeholder='https://app.example.com'
            />
            {errors.url && <p className='mt-1 text-xs text-red-500'>{errors.url.message}</p>}
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label htmlFor='username' className='mb-1 block text-sm font-medium text-gray-700'>
                Username <span className='text-gray-400'>(optional)</span>
              </label>
              <input
                id='username'
                type='text'
                {...register('username')}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                placeholder='admin@example.com'
              />
            </div>
            <div>
              <label htmlFor='password' className='mb-1 block text-sm font-medium text-gray-700'>
                Password <span className='text-gray-400'>(optional)</span>
              </label>
              <input
                id='password'
                type='password'
                {...register('password')}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                placeholder='••••••••'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label htmlFor='maxDepth' className='mb-1 block text-sm font-medium text-gray-700'>
                Max Depth
              </label>
              <input
                id='maxDepth'
                type='number'
                {...register('maxDepth')}
                defaultValue={5}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
              />
            </div>
            <div>
              <label htmlFor='maxPages' className='mb-1 block text-sm font-medium text-gray-700'>
                Max Pages
              </label>
              <input
                id='maxPages'
                type='number'
                {...register('maxPages')}
                defaultValue={100}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
              />
            </div>
          </div>

          <div className='flex gap-6'>
            <label className='flex items-center gap-2 text-sm text-gray-700'>
              <input type='checkbox' {...register('includeScreenshots')} defaultChecked />
              Screenshots
            </label>
            <label className='flex items-center gap-2 text-sm text-gray-700'>
              <input type='checkbox' {...register('includeVideo')} />
              Video Recording
            </label>
          </div>

          <div className='flex justify-end gap-3 pt-2'>
            <Button variant='secondary' type='button' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' loading={isPending}>
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
