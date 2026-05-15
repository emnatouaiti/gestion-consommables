<?php

function parseLines($text) {
    $lines  = array_filter(array_map('trim', preg_split('/\r\n|\r|\n/', $text)));
    $parsed = [];

    $refBlacklist = [
        'reference', 'date', 'page', 'total', 'quantite', 'description', 'nom', 'client', 
        'adresse', 'contact', 'phone', 'reception', 'livraison', 'bon', 'details',
        'reterence', 'riterence', 'relerence', 'relerence', 'quantit', 'observations',
        'n*', 'n.', 'techpro', 'solutions', 'destinataire', 'dtails', 'details', 'livraison',
        'rifrence', 'ritrence', 'produit', 'desc', 'descr', 'qte', 'qty', 'descriptiondnproduit'
    ];

    foreach ($lines as $line) {
        $clean = preg_replace('/[\|\[\]\(\)_]+/', ' ', $line);
        $clean = preg_replace('/[^\p{L}\d\.\-\s]/u', ' ', $clean);
        $clean = preg_replace('/\s+/', ' ', $clean);
        $clean = trim((string) $clean);
        if ($clean === '') {
            continue;
        }

        $tokens = preg_split('/\s+/', $clean);
        if (count($tokens) < 2) {
            continue;
        }

        $qty      = null;
        $ordered  = null;

        // 1. Détection de la quantité en partant de la fin
        for ($i = count($tokens) - 1; $i >= 0; $i--) {
            $rawTok = $tokens[$i];
            $tok = trim($rawTok, ',.;:+-()[] '); 
            
            if (is_numeric($tok)) {
                $val = (int) $tok;
                if ($val > 500 && count($tokens) > 2) {
                    continue;
                }
                if ($val >= 2000 && $val <= 2100) { 
                    continue;
                }

                $qty = $val;
                if ($i > 0 && is_numeric(trim($tokens[$i - 1], ',.;:+-()[] '))) {
                    $ordered = (int) trim($tokens[$i - 1], ',.;:+-()[] ');
                    array_splice($tokens, $i - 1, 2);
                } else {
                    array_splice($tokens, $i, 1);
                }
                break;
            } else {
                // Fuzzy check for common OCR misreads in quantities (e.g. l0 -> 10, io -> 10)
                $fuzzy = strtr(strtolower($tok), ['l' => '1', 'i' => '1', 'o' => '0', 's' => '5', 'z' => '2', 'b' => '8', 'g' => '9']);
                if (is_numeric($fuzzy) && strlen($fuzzy) > 0 && strlen($fuzzy) <= 3) {
                    $qty = (int)$fuzzy;
                    array_splice($tokens, $i, 1);
                    break;
                }
            }
        }

        // 2. Extraction de la référence
        $ref = null;
        foreach ($tokens as $i => $tok) {
            $lowTok = strtolower($tok);
            if (in_array($lowTok, $refBlacklist) || strlen($tok) < 2) continue;

            if (preg_match('/^INV-/i', $tok) || (preg_match('/[A-Z]/i', $tok) && preg_match('/\d/', $tok))) {
                $ref = $tok;
                unset($tokens[$i]);
                $tokens = array_values($tokens);
                break;
            }
            
            if ($i === 0 && !preg_match('/^\d{4}$/', $tok)) {
                $ref = $tok;
                unset($tokens[$i]);
                $tokens = array_values($tokens);
                break;
            }
        }

        $title = trim(implode(' ', $tokens));
        $title = str_ireplace(['gelmain', 'DescriptiondnProduit'], ['gel a main', ''], $title);
        $title = trim(preg_replace('/\s+/', ' ', $title));
        $title = trim($title, ',.:;+- ');

        if (!$ref || in_array(strtolower($ref), $refBlacklist)) {
            continue;
        }
        
        if (strlen($ref) < 3 && strlen($title) < 5) {
            continue;
        }

        $parsed[] = [
            'reference'        => $ref,
            'title'            => $title ?: 'Produit sans titre',
            'quantity'         => $qty,
            'ordered_quantity' => $ordered,
        ];
    }

    return $parsed;
}

$ocrText = <<<EOD
Rifrence  DescriptiondnProduit_  Quantit) Observations_

INV-000 Odinateur Portable Del Latitude 5420, ule

INV-0002    ar sans fil fil Logitech M185,  Logitech
EOD;

echo "--- Test avec le texte problématique ---\n";
$result = parseLines($ocrText);
print_r($result);

$ocrText2 = <<<EOD
INV-0001 Ordinateur Portable Dell Latitude 5420 l0
INV-0002 Souris sans fil Logitech M185 25
EOD;

echo "\n--- Test avec des erreurs OCR simulées (l0 -> 10) ---\n";
$result2 = parseLines($ocrText2);
print_r($result2);
