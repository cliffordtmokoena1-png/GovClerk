import React, { useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useToast,
} from "@chakra-ui/react";
import { CreditDetail } from "@/types/subscription";

interface CreditDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokenDetails: CreditDetail[];
}

export default function CreditDetailsModal({
  isOpen,
  onClose,
  tokenDetails,
}: CreditDetailsModalProps) {
  const toast = useToast();
  const [loadingIds, setLoadingIds] = useState<string[]>([]);

  const handleDownloadInvoice = async (invoiceId: string) => {
    try {
      setLoadingIds((prev) => [...prev, invoiceId]);
      const res = await fetch("/api/get-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });

      if (!res.ok) {
        throw new Error("Failed to download");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `Invoice-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Invoice download failed", err);
      toast({
        title: "Download failed",
        description: "We couldn't download your invoice. Please contact support.",
        status: "error",
        duration: 5000,
        isClosable: true,
        position: "top-right",
      });
    } finally {
      setLoadingIds((prev) => prev.filter((id) => id !== invoiceId));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Token History</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={2}>
          <Table variant="simple" size="sm">
            <Thead>
              <Tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Amount</Th>
                <Th>Description</Th>
              </Tr>
            </Thead>
            <Tbody overflowY="auto">
              {tokenDetails.map((detail) => (
                <Tr key={detail.id}>
                  <Td>{new Date(detail.created_at).toLocaleDateString()}</Td>
                  <Td>{detail.action === "add" ? "Payment" : "Usage"}</Td>
                  <Td color={detail.action === "add" ? "green.500" : "red.500"}>
                    {detail.action === "add" ? "+" : ""}
                    {detail.token}
                  </Td>
                  <Td>
                    {detail.action === "add" ? (
                      detail.invoice_id ? (
                        <Button
                          size="xs"
                          colorScheme="blue"
                          variant="outline"
                          onClick={() =>
                            detail.invoice_id && handleDownloadInvoice(detail.invoice_id)
                          }
                          isLoading={loadingIds.includes(detail.invoice_id)}
                          loadingText="Opening"
                        >
                          Download Invoice
                        </Button>
                      ) : (
                        "Complimentary tokens"
                      )
                    ) : detail.transcript_title ? (
                      `Transcript: ${detail.transcript_title.replace(/\.mp3$/, "")}`
                    ) : (
                      "Transcript processing"
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </ModalBody>
        <ModalFooter>
          <Button colorScheme="blue" mr={3} onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
