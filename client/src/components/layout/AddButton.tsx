import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddMessageModal } from '@/components/messages/AddMessageModal';

export function AddButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#b95827] hover:bg-[#a04d1f] shadow-lg hover:shadow-xl transition-all duration-200 p-0"
        aria-label="Add message"
      >
        <Plus className="h-6 w-6 text-white" />
      </Button>

      <AddMessageModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}