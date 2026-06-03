'use client'

import { useState, useEffect } from 'react'
import List from '@mui/material/List'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import ListItem from '@mui/material/ListItem'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { toast } from 'react-toastify'
import { useDropzone } from 'react-dropzone'

const MediaUploader = ({ uploadType, onFilesUpdate }) => {
  const [files, setFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)

  // 🟢 FIX 1: Safely pass data to parent ONLY when files array changes
  useEffect(() => {
    if (onFilesUpdate) {
      onFilesUpdate(files)
    }
  }, [files, onFilesUpdate])

  const getAcceptedTypes = () => {
    if (uploadType === 'upload-images') return { 'image/*': ['.png', '.jpg', '.jpeg', '.gif'] }
    if (uploadType === 'upload-videos') return { 'video/*': ['.mp4', '.webm', '.ogg'] }
    return {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      'video/*': ['.mp4', '.webm', '.ogg']
    }
  }

  const { getRootProps, getInputProps } = useDropzone({
    maxSize: 5000000,
    accept: getAcceptedTypes(),
    onDrop: async acceptedFiles => {
      setIsUploading(true)
      const newUploadedFiles = []

      for (const file of acceptedFiles) {
        // Create a safe local URL for the file to prevent createObjectURL crashes
        const safeUrl = URL.createObjectURL(file)
        newUploadedFiles.push({ name: file.name, url: safeUrl, type: file.type })
      }

      setFiles(prev => [...prev, ...newUploadedFiles])
      setIsUploading(false)
    },
    onDropRejected: () => {
      toast.error('File rejected. Max size is 5MB.')
    }
  })

  const handleRemoveFile = file => {
    setFiles(prev => prev.filter(i => i.name !== file.name))
  }

  const handleRemoveAllFiles = () => {
    setFiles([])
  }

  // 🟢 FIX 2: Use file.url directly instead of wrapping in createObjectURL again
  const fileList = files.map(file => (
    <ListItem key={file.name} className='border rounded-md mbe-2 p-2 flex items-center justify-between'>
      <div className='flex items-center gap-4'>
        {file.type.startsWith('image') ? (
          <img width={38} height={38} alt={file.name} src={file.url} className='rounded-md object-cover' />
        ) : (
          <i className='ri-video-line text-2xl text-primary' />
        )}
        <div>
          <Typography variant='body2' className='font-medium'>{file.name}</Typography>
        </div>
      </div>
      <IconButton size='small' onClick={() => handleRemoveFile(file)}>
        <i className='ri-close-line text-error' />
      </IconButton>
    </ListItem>
  ))

  return (
    <div>
      <div {...getRootProps({ className: 'dropzone border-2 border-dashed border-divider rounded-xl p-8 cursor-pointer hover:bg-actionHover transition-colors bg-backgroundPaper/50' })}>
        <input {...getInputProps()} />
        <div className='flex items-center flex-col text-center'>
          <Avatar variant='rounded' className='w-12 h-12 mbe-4 bg-primary/10 text-primary'>
            <i className='ri-upload-2-line text-2xl' />
          </Avatar>
          <Typography variant='h5' className='mbe-2 font-semibold text-textPrimary'>
            Drop files here or click to upload.
          </Typography>
          <Typography color='text.secondary' variant='body2'>
            {uploadType === 'upload-images' ? 'Allowed *.jpeg, *.jpg, *.png, *.gif' :
             uploadType === 'upload-videos' ? 'Allowed *.mp4, *.webm, *.ogg' :
             'Allowed Images and Videos'}
          </Typography>
          <Typography color='text.secondary' variant='caption'>Max size limit per file: 5 MB</Typography>
        </div>
      </div>

      {files.length > 0 && (
        <div className='mt-4'>
          <List className='p-0'>{fileList}</List>
          <div className='flex justify-end mt-4'>
            <Button color='error' variant='outlined' size='small' onClick={handleRemoveAllFiles}>
              Remove All
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default MediaUploader
