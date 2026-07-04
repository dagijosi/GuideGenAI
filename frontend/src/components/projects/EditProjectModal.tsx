import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import Button from '../ui/Button';
import { useUpdateProject } from '../../hooks/useProjects';
import type { Project } from '../../types';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Must be a valid URL'),
  username: z.string().optional(),
  password: z.string().optional(),
  maxDepth: z.coerce.number().min(1).max(20).default(5),
  maxPages: z.coerce.number().min(1).max(500).default(100),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  project: Project;
  onClose: () => void;
}

export default function EditProjectModal({ project, onClose }: Props) {
  const { mutateAsync, isPending } = useUpdateProject();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project.name,
      url: project.url,
      username: project.credentials?.username ?? '',
      password: '',
      maxDepth: 5,
      maxPages: 100,
    },
  });

  // Sync if project changes
  useEffect(() => {
    reset({
      name: project.name,
      url: project.url,
      username: project.credentials?.username ?? '',
      password: '',
      maxDepth: 5,
      maxPages: 100,
    });
  }, [project.id, reset]);

  const onSubmit = async (data: FormValues) => {
    await mutateAsync({ id: project.id, payload: data });
    onClose();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl'>
        {/* Header */}
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h2 className='text-lg font-semibold text-gray-900'>Edit Project</h2>
            <p className='mt-0.5 text-sm text-gray-500'>
              Changes apply to the next run, not the existing results.
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-lg p-1.5 text-gray-400 hover:bg-gray-100'
            aria-label='Close'
          >
            <X className='h-5 w-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className='space-y-4'>
          {/* Name */}
          <div>
            <label htmlFor='edit-name' className='mb-1 block text-sm font-medium text-gray-700'>
              Project Name
            </label>
            <input
              id='edit-name'
              type='text'
              {...register('name')}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
            />
            {errors.name && (
              <p className='mt-1 text-xs text-red-500'>{errors.name.message}</p>
            )}
          </div>

          {/* URL */}
          <div>
            <label htmlFor='edit-url' className='mb-1 block text-sm font-medium text-gray-700'>
              Website URL
            </label>
            <input
              id='edit-url'
              type='url'
              {...register('url')}
              className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
            />
            {errors.url && (
              <p className='mt-1 text-xs text-red-500'>{errors.url.message}</p>
            )}
          </div>

          {/* Credentials */}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label
                htmlFor='edit-username'
                className='mb-1 block text-sm font-medium text-gray-700'
              >
                Username <span className='text-gray-400'>(optional)</span>
              </label>
              <input
                id='edit-username'
                type='text'
                {...register('username')}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                placeholder='admin@example.com'
              />
            </div>
            <div>
              <label
                htmlFor='edit-password'
                className='mb-1 block text-sm font-medium text-gray-700'
              >
                Password <span className='text-gray-400'>(leave blank to keep)</span>
              </label>
              <input
                id='edit-password'
                type='password'
                {...register('password')}
                className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                placeholder='••••••••'
              />
            </div>
          </div>

          {/* Crawl options */}
          <div className='rounded-lg bg-gray-50 p-4'>
            <p className='mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500'>
              Crawl Settings
            </p>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <label
                  htmlFor='edit-maxDepth'
                  className='mb-1 block text-sm font-medium text-gray-700'
                >
                  Max Depth
                  <span className='ml-1 text-xs text-gray-400'>(link levels)</span>
                </label>
                <input
                  id='edit-maxDepth'
                  type='number'
                  min={1}
                  max={20}
                  {...register('maxDepth')}
                  className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                />
              </div>
              <div>
                <label
                  htmlFor='edit-maxPages'
                  className='mb-1 block text-sm font-medium text-gray-700'
                >
                  Max Pages
                  <span className='ml-1 text-xs text-gray-400'>(cap)</span>
                </label>
                <input
                  id='edit-maxPages'
                  type='number'
                  min={1}
                  max={500}
                  {...register('maxPages')}
                  className='w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'
                />
              </div>
            </div>
          </div>

          <div className='flex justify-end gap-3 pt-1'>
            <Button variant='secondary' type='button' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' loading={isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
