import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { VStack } from "@astryxdesign/core/VStack";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { reportSharedCollection, unshareCollection } from "@/services/community.service";
import type { SharedCollection } from "@/types/community.types";

import { communityQueryKey } from "../hooks/use-community";
import { errorMessage } from "../error-message";

/** Matches the server's limit. */
const MAX_REASON_LENGTH = 500;

/** Reports a collection to the moderators, with an optional reason. */
export function ReportDialog({
  collection,
  onClose,
}: {
  collection: SharedCollection;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const report = useMutation({
    mutationFn: () =>
      reportSharedCollection(collection.id, reason.trim() === "" ? null : reason.trim()),
    onSuccess: (isNew) => {
      toast.success(
        isNew
          ? "Thanks, the moderators will take a look."
          : "You already reported this collection.",
      );
      onClose();
    },
  });
  const isTooLong = reason.length > MAX_REASON_LENGTH;

  return (
    <Modal purpose="form" title={`Report “${collection.title}”?`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isTooLong && !report.isPending) report.mutate();
        }}
      >
        <VStack gap={4}>
          <Text type="supporting" as="p">
            Report collections with spam, malware, or links that break the rules. The owner
            isn&apos;t told who reported it.
          </Text>
          <TextArea
            label="Reason (optional)"
            value={reason}
            rows={3}
            onChange={setReason}
            hasAutoFocus
          />
          {isTooLong && (
            <Banner
              role="alert"
              status="error"
              title={`Use at most ${String(MAX_REASON_LENGTH)} characters.`}
            />
          )}
          {report.isError && (
            <Banner role="alert" status="error" title={errorMessage(report.error)} />
          )}
          <HStack gap={2} hAlign="end">
            <Button variant="ghost" label="Cancel" onClick={onClose} />
            <Button
              type="submit"
              variant="destructive"
              label="Report"
              isLoading={report.isPending}
              isDisabled={isTooLong}
            />
          </HStack>
        </VStack>
      </form>
    </Modal>
  );
}

/** Takes the owner's published collection down, then returns to Community. */
export function UnshareDialog({
  collectionId,
  onClose,
}: {
  collectionId: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unshare = useMutation({
    mutationFn: () => unshareCollection(collectionId),
    onSuccess: async () => {
      // Leave first: refetching the page's own collection would only find it gone.
      queryClient.removeQueries({ queryKey: [...communityQueryKey, "collection", collectionId] });
      toast.success("Removed from Community");
      await navigate("/community");
      await queryClient.invalidateQueries({ queryKey: communityQueryKey });
    },
  });

  return (
    <Modal title="Unshare this collection?" onClose={onClose}>
      <VStack gap={4}>
        <Text type="supporting" as="p">
          It disappears from Community for everyone. Your own collection and its links stay in
          DevAtlas.
        </Text>
        {unshare.isError && (
          <Banner role="alert" status="error" title={errorMessage(unshare.error)} />
        )}
        <HStack gap={2} hAlign="end">
          <Button variant="ghost" label="Cancel" onClick={onClose} />
          <Button
            variant="destructive"
            label="Unshare"
            isLoading={unshare.isPending}
            onClick={() => {
              unshare.mutate();
            }}
          />
        </HStack>
      </VStack>
    </Modal>
  );
}
