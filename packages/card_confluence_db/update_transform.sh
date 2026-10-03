sed -i 's/oracle_id: scryfall.oracle_id.unwrap(),/oracle_id: scryfall.oracle_id.unwrap().parse().unwrap(),/' /home/dev/GitHub/card-confluence/packages/card_confluence_db/src/seed/transform.rs
