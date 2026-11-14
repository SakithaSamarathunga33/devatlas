import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";

import { useDeleteCommunityAccount } from "../hooks/use-community";
import { errorMessage } from "../error-message";

/** What deleting the account removes from the Community server. */
const REMOVED = [
  "Your profile: your GitHub username and avatar",
  "Every collection you shared, with all of its links",
  "Your follows, and everyone's follows of your collections",
  "Reports you filed, and reports on your collections",
];

/** Confirms, then erases the Community account; `onDeleted` runs once DevAtlas is signed out. */
export function DeleteAccountDialog({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteCommunityAccount();

  return (
    <Modal title="Delete your Community account?" onClose={onClose}>
      <VStack gap={4}>
        <Text as="p">This permanently removes from Community:</Text>
        <ul aria-label="Removed from Community" className="list-disc space-y-1 ps-5">
          {REMOVED.map((item) => (
            <li key={item}>
              <Text type="supporting">{item}</Text>
            </li>
          ))}
        </ul>
        <Text type="supporting" as="p">
          Your library, collections and snippets on this computer stay exactly as they are. You can
          sign in again later, starting with an empty Community account.
        </Text>
        {remove.isError && (
          <Banner
            role="alert"
            status="error"
            title="Couldn't delete your account"
            description={errorMessage(remove.error)}
          />
        )}
        <HStack gap={2} hAlign="end">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button
            variant="destructive"
            label="Delete account"
            isLoading={remove.isPending}
            onClick={() => {
              remove.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Your Community account was deleted");
                  onDeleted();
                },
              });
            }}
          />
        </HStack>
      </VStack>
    </Modal>
  );
}
