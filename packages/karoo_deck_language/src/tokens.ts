import { ExternalTokenizer } from "@lezer/lr";
import { queryContent } from "./syntax.grammar.terms";

export const scanQueryContent = new ExternalTokenizer((input) => {
    let len = 0;
    while (input.next != 93 && input.next != -1) {
        // 93 is ']'
        input.advance();
        len++;
    }
    if (len > 0) {
        input.acceptToken(queryContent);
    }
});
