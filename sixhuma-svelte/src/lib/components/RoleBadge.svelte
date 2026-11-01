<script lang="ts">
  import type { ParticipantRole } from 'sixhuma-core';

  let { role }: { role: ParticipantRole | string } = $props();

  const CLASS_BY_ROLE: Record<string, string> = {
    Host: 'role-badge--host',
    Organizer: 'role-badge--organizer',
    Speaker: 'role-badge--speaker',
    Attendee: 'role-badge--attendee',
    Presentation: 'role-badge--presentation',
  };
</script>

<span class={`role-badge ${CLASS_BY_ROLE[role] || 'role-badge--attendee'}`}>
  {role}
</span>
