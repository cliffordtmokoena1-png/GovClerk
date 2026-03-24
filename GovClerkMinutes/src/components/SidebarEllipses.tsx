import { IconButton, Menu, MenuButton, MenuItem, MenuList, useToast } from "@chakra-ui/react";
import { useRouter } from "next/router";
import { IoEllipsisVertical } from "react-icons/io5";
import { FiCopy, FiEdit2, FiTrash2 } from "react-icons/fi";

type Props = {
  pageTranscriptId?: number | null;
  itemTranscriptId: number;
  bgColor: string;
  onDelete: () => void;
  onRename: (id: number) => void;
};

export default function SidebarEllipses({
  pageTranscriptId,
  itemTranscriptId,
  bgColor,
  onDelete,
  onRename,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  const handleCopyId = async (e: React.MouseEvent) => {
    e.stopPropagation();

    await navigator.clipboard.writeText(itemTranscriptId.toString());
    toast({
      title: "ID copied to clipboard",
      description: `Transcript ID ${itemTranscriptId} has been copied`,
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  return (
    <>
      <Menu isLazy>
        <MenuButton
          as={IconButton}
          aria-label="Options"
          icon={<IoEllipsisVertical size={20} />}
          variant="solid"
          bgColor={bgColor}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
        <MenuList>
          <MenuItem
            icon={<FiEdit2 />}
            onClick={(e) => {
              e.stopPropagation();
              onRename(itemTranscriptId);
            }}
          >
            Rename
          </MenuItem>
          <MenuItem icon={<FiCopy />} onClick={handleCopyId}>
            Copy ID
          </MenuItem>
          <MenuItem
            icon={<FiTrash2 />}
            fontWeight="bold"
            color="red.500"
            onClick={async (e) => {
              e.stopPropagation();
              const res = await fetch("/api/delete-transcript", {
                method: "POST",
                body: JSON.stringify({ transcriptId: itemTranscriptId }),
              });
              if (!res.ok) {
                return;
              }
              if (pageTranscriptId === itemTranscriptId) {
                router.push("/dashboard");
              }
              onDelete();
            }}
          >
            Delete
          </MenuItem>
        </MenuList>
      </Menu>
    </>
  );
}
