import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { SideNavItem } from "@astryxdesign/core/SideNav";
import { LogOut } from "lucide-react";
import { type ComponentType, type SVGProps, useMemo } from "react";
import { toast } from "sonner";

import {
  errorMessage,
  OwnerAvatar,
  useCommunitySession,
  useCommunitySignIn,
  useCommunitySignOut,
} from "@/features/community";
import { GithubMark } from "@/features/discovery";
import { cn } from "@/lib/utils";

/** Longer GitHub names are cut to this many characters, ending in an ellipsis. */
const NAME_CHARS = 14;

function shortName(name: string): string {
  return name.length > NAME_CHARS ? `${name.slice(0, NAME_CHARS - 1)}…` : name;
}

/** SideNav icons are components; this one draws the account's GitHub avatar in the icon slot. */
function avatarIcon(src: string | null): ComponentType<SVGProps<SVGSVGElement>> {
  return function AvatarIcon({ className }: SVGProps<SVGSVGElement>) {
    return <OwnerAvatar src={src} className={cn("size-5", className)} />;
  };
}

/**
 * The account item under Settings: the GitHub avatar and name when signed in (opening Settings),
 * a long name cut short with an ellipsis and a Sign out button at the row's end; otherwise "Sign in with GitHub", which a second press cancels.
 */
export function AccountNavItem() {
  const session = useCommunitySession();
  const { signIn, cancel } = useCommunitySignIn();
  const signOut = useCommunitySignOut();
  const user = session.data ?? null;
  const avatarUrl = user?.avatarUrl ?? null;
  const AvatarIcon = useMemo(() => avatarIcon(avatarUrl), [avatarUrl]);

  if (session.isPending) return null;
  if (user !== null) {
    return (
      <SideNavItem
        label={shortName(user.username)}
        aria-label={user.username}
        icon={AvatarIcon}
        href="/settings"
        actions={
          <IconButton
            label="Sign out"
            tooltip="Sign out"
            variant="ghost"
            icon={<Icon icon={LogOut} />}
            isDisabled={signOut.isPending}
            onClick={() => {
              signOut.mutate(undefined, {
                onError: (error) => {
                  toast.error("Couldn't sign out", { description: errorMessage(error) });
                },
              });
            }}
          />
        }
      />
    );
  }
  if (signIn.isPending) {
    return <SideNavItem label="Waiting for GitHub… (cancel)" icon={GithubMark} onClick={cancel} />;
  }
  return (
    <SideNavItem
      label="Sign in with GitHub"
      icon={GithubMark}
      onClick={() => {
        signIn.mutate(undefined, {
          onError: (error) => {
            toast.error("Couldn't sign in", {
              description: errorMessage(error),
            });
          },
        });
      }}
    />
  );
}
