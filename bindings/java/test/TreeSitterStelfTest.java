import io.github.treesitter.jtreesitter.Language;
import io.github.treesitter.jtreesitter.stelf.TreeSitterStelf;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

public class TreeSitterStelfTest {
    @Test
    public void testCanLoadLanguage() {
        assertDoesNotThrow(() -> new Language(TreeSitterStelf.language()));
    }
}
