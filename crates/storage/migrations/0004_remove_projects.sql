-- Projects were removed. Keep their links by turning them into collections.
UPDATE link_groups SET kind = 'collection', folder = NULL;
UPDATE snippets SET group_id = NULL;
