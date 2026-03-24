import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  VStack,
  HStack,
  FormControl,
  FormLabel,
  FormHelperText,
  Input,
  Textarea,
  Button,
  Switch,
  IconButton,
  Text,
  Image,
  Flex,
  Divider,
  useToast,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { HiPlus, HiTrash, HiPhoto } from "react-icons/hi2";
import {
  PortalSettings,
  NavLink,
  CreatePortalSettingsRequest,
  UpdatePortalSettingsRequest,
} from "@/types/portal";
import { usePortalSettings } from "@/hooks/portal";
import { useOrgContext } from "@/contexts/OrgContext";

type Props = {
  settings: PortalSettings | null;
};

type FormData = {
  slug: string;
  pageTitle: string;
  pageDescription: string;
  logoUrl: string;
  headerBgColor: string;
  headerTextColor: string;
  accentColor: string;
  navLinks: NavLink[];
  isEnabled: boolean;
};

const defaultFormData: FormData = {
  slug: "",
  pageTitle: "",
  pageDescription: "",
  logoUrl: "",
  headerBgColor: "#1a365d",
  headerTextColor: "#ffffff",
  accentColor: "#3182ce",
  navLinks: [],
  isEnabled: false,
};

export default function PortalSettingsForm({ settings }: Props) {
  const { createSettings, updateSettings } = usePortalSettings();
  const { orgSlug } = useOrgContext();
  const toast = useToast();
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-populate slug from organization
  useEffect(() => {
    if (orgSlug) {
      setFormData((prev) => ({ ...prev, slug: orgSlug }));
    }
  }, [orgSlug]);

  useEffect(() => {
    if (settings) {
      setFormData({
        slug: orgSlug || settings.slug,
        pageTitle: settings.pageTitle || "",
        pageDescription: settings.pageDescription || "",
        logoUrl: settings.logoUrl || "",
        headerBgColor: settings.headerBgColor,
        headerTextColor: settings.headerTextColor,
        accentColor: settings.accentColor,
        navLinks: settings.navLinks || [],
        isEnabled: settings.isEnabled,
      });
    }
  }, [settings, orgSlug]);

  const handleInputChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    },
    []
  );

  const handleSwitchChange = useCallback(
    (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.checked }));
    },
    []
  );

  const handleAddNavLink = useCallback(() => {
    setFormData((prev) => ({
      ...prev,
      navLinks: [...prev.navLinks, { label: "", url: "" }],
    }));
  }, []);

  const handleRemoveNavLink = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      navLinks: prev.navLinks.filter((_, i) => i !== index),
    }));
  }, []);

  const handleNavLinkChange = useCallback(
    (index: number, field: "label" | "url", value: string) => {
      setFormData((prev) => ({
        ...prev,
        navLinks: prev.navLinks.map((link, i) =>
          i === index ? { ...link, [field]: value } : link
        ),
      }));
    },
    []
  );

  const handleLogoUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const response = await fetch("/api/s3", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get upload URL");
        }

        const { uploadUrl, fileUrl } = await response.json();

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        setFormData((prev) => ({ ...prev, logoUrl: fileUrl }));
        toast({
          title: "Logo uploaded",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
      } catch (error) {
        toast({
          title: "Upload failed",
          description: "Failed to upload logo. Please try again.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      }
    },
    [toast]
  );

  const handleSubmit = async () => {
    const slug = orgSlug;
    if (!slug) {
      toast({
        title: "Organization slug required",
        description: "Your organization must have a slug configured in Clerk",
        status: "error",
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    setIsSaving(true);
    try {
      const validNavLinks = formData.navLinks.filter((link) => link.label && link.url);

      if (settings) {
        const updateData: UpdatePortalSettingsRequest = {
          pageTitle: formData.pageTitle || undefined,
          pageDescription: formData.pageDescription || undefined,
          logoUrl: formData.logoUrl || undefined,
          headerBgColor: formData.headerBgColor,
          headerTextColor: formData.headerTextColor,
          accentColor: formData.accentColor,
          navLinks: validNavLinks.length > 0 ? validNavLinks : undefined,
          isEnabled: formData.isEnabled,
        };
        await updateSettings(settings.id, updateData);
      } else {
        const createData: CreatePortalSettingsRequest = {
          slug,
          pageTitle: formData.pageTitle || undefined,
          pageDescription: formData.pageDescription || undefined,
          logoUrl: formData.logoUrl || undefined,
          headerBgColor: formData.headerBgColor,
          headerTextColor: formData.headerTextColor,
          accentColor: formData.accentColor,
          navLinks: validNavLinks.length > 0 ? validNavLinks : undefined,
          isEnabled: formData.isEnabled,
        };
        await createSettings(createData);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Box bg="white" borderRadius="lg" p={6} boxShadow="sm">
      <VStack spacing={6} align="stretch">
        <Text fontSize="lg" fontWeight="semibold" color="gray.800">
          {settings ? "Edit Portal Settings" : "Create Portal"}
        </Text>

        <FormControl>
          <FormLabel>Portal URL</FormLabel>
          <Input value={`/portal/${formData.slug || "your-org-slug"}`} isReadOnly bg="gray.50" />
          <FormHelperText>
            Your portal will be available at: /portal/{formData.slug || "your-org-slug"}
          </FormHelperText>
          <Alert status="info" mt={2} borderRadius="md" fontSize="sm">
            <AlertIcon />
            Your portal URL uses your organization slug. To change it, update your organization
            settings in Clerk.
          </Alert>
        </FormControl>

        <FormControl>
          <FormLabel>Page Title</FormLabel>
          <Input
            value={formData.pageTitle}
            onChange={handleInputChange("pageTitle")}
            placeholder="City Council Meeting Minutes"
            maxLength={255}
          />
        </FormControl>

        <FormControl>
          <FormLabel>Description</FormLabel>
          <Textarea
            value={formData.pageDescription}
            onChange={handleInputChange("pageDescription")}
            placeholder="Public meeting minutes and agendas for our organization"
            rows={3}
          />
        </FormControl>

        <Divider />

        <Text fontSize="md" fontWeight="medium" color="gray.700">
          Branding
        </Text>

        <FormControl>
          <FormLabel>Logo</FormLabel>
          <Flex gap={4} align="center">
            {formData.logoUrl ? (
              <Image
                src={formData.logoUrl}
                alt="Portal logo"
                maxH="60px"
                maxW="200px"
                objectFit="contain"
                borderRadius="md"
              />
            ) : (
              <Flex
                w="60px"
                h="60px"
                bg="gray.100"
                borderRadius="md"
                align="center"
                justify="center"
              >
                <HiPhoto size={24} color="#A0AEC0" />
              </Flex>
            )}
            <Box>
              <Input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                display="none"
                id="logo-upload"
              />
              <Button as="label" htmlFor="logo-upload" size="sm" variant="outline" cursor="pointer">
                {formData.logoUrl ? "Change Logo" : "Upload Logo"}
              </Button>
            </Box>
          </Flex>
        </FormControl>

        <HStack spacing={4}>
          <FormControl>
            <FormLabel>Header Background</FormLabel>
            <HStack>
              <Input
                type="color"
                value={formData.headerBgColor}
                onChange={handleInputChange("headerBgColor")}
                w="60px"
                p={1}
                h="40px"
              />
              <Input
                value={formData.headerBgColor}
                onChange={handleInputChange("headerBgColor")}
                placeholder="#1a365d"
                maxLength={7}
              />
            </HStack>
          </FormControl>

          <FormControl>
            <FormLabel>Header Text</FormLabel>
            <HStack>
              <Input
                type="color"
                value={formData.headerTextColor}
                onChange={handleInputChange("headerTextColor")}
                w="60px"
                p={1}
                h="40px"
              />
              <Input
                value={formData.headerTextColor}
                onChange={handleInputChange("headerTextColor")}
                placeholder="#ffffff"
                maxLength={7}
              />
            </HStack>
          </FormControl>

          <FormControl>
            <FormLabel>Accent Color</FormLabel>
            <HStack>
              <Input
                type="color"
                value={formData.accentColor}
                onChange={handleInputChange("accentColor")}
                w="60px"
                p={1}
                h="40px"
              />
              <Input
                value={formData.accentColor}
                onChange={handleInputChange("accentColor")}
                placeholder="#3182ce"
                maxLength={7}
              />
            </HStack>
          </FormControl>
        </HStack>

        <Divider />

        <Box>
          <Flex justify="space-between" align="center" mb={3}>
            <Text fontSize="md" fontWeight="medium" color="gray.700">
              Navigation Links
            </Text>
            <Button size="sm" leftIcon={<HiPlus />} onClick={handleAddNavLink} variant="outline">
              Add Link
            </Button>
          </Flex>

          <VStack spacing={3} align="stretch">
            {formData.navLinks.map((link, index) => (
              <HStack key={index} spacing={3}>
                <Input
                  placeholder="Label"
                  value={link.label}
                  onChange={(e) => handleNavLinkChange(index, "label", e.target.value)}
                  flex={1}
                />
                <Input
                  placeholder="URL"
                  value={link.url}
                  onChange={(e) => handleNavLinkChange(index, "url", e.target.value)}
                  flex={2}
                />
                <IconButton
                  aria-label="Remove link"
                  icon={<HiTrash />}
                  size="sm"
                  variant="ghost"
                  colorScheme="red"
                  onClick={() => handleRemoveNavLink(index)}
                />
              </HStack>
            ))}
            {formData.navLinks.length === 0 && (
              <Text fontSize="sm" color="gray.500" textAlign="center" py={2}>
                No navigation links added yet
              </Text>
            )}
          </VStack>
        </Box>

        <Divider />

        <FormControl display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <FormLabel mb={0}>Enable Portal</FormLabel>
            <FormHelperText mt={1}>Make your portal public</FormHelperText>
          </Box>
          <Switch
            isChecked={formData.isEnabled}
            onChange={handleSwitchChange("isEnabled")}
            colorScheme="blue"
            size="lg"
          />
        </FormControl>

        <Button
          colorScheme="blue"
          size="lg"
          onClick={handleSubmit}
          isLoading={isSaving}
          loadingText="Saving..."
          isDisabled={!orgSlug}
        >
          {settings ? "Save Changes" : "Create Portal"}
        </Button>
      </VStack>
    </Box>
  );
}
