import React from 'react';
import { useParams } from 'react-router-dom';
import { MarkdownEditor } from '../../components/Editor/MarkdownEditor';

export const FileView: React.FC = () => {
  const { fileId } = useParams();

  if (!fileId) return <div>No file specified</div>;

  return (
    <div className="flex w-full h-full">
      <MarkdownEditor fileId={fileId} />
    </div>
  );
};
