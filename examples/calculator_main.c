/* Runnable main for CalculatorSystem — overwrites generated main.c after compile */
#include <stdio.h>
#include "Calculator.h"

int main(void) {
    Calculator_t *calc = Calculator_create();
    if (!calc) { fprintf(stderr, "Failed to create Calculator\n"); return 1; }

    printf("=== Calculator (ketik: <angka> <op> <angka>  e.g. 3 + 4) ===\n");
    printf("Operator: + - * /   |  c=clear  m=store result  r=recall  q=quit\n");

    char line[128];
    while (1) {
        float res = Calculator_recall(calc);
        printf("\n[mem=%.2f] > ", res);
        if (!fgets(line, sizeof(line), stdin)) break;

        // trim
        if (line[0]=='q' || line[0]=='Q') break;
        if (line[0]=='c' || line[0]=='C') { Calculator_clear(calc); puts("cleared"); continue; }
        if (line[0]=='r' || line[0]=='R') { printf("memory = %.4f\n", Calculator_recall(calc)); continue; }
        if (line[0]=='m' || line[0]=='M') { Calculator_store(calc, calc->result); printf("stored %.4f\n", calc->result); continue; }
        if (line[0]=='\n' || line[0]=='\0') continue;

        float a, b, out = 0;
        char op;
        if (sscanf(line, "%f %c %f", &a, &op, &b) != 3) { puts("format: <a> <op> <b>  contoh: 12 / 4"); continue; }

        switch (op) {
            case '+': out = Calculator_add(calc, a, b); break;
            case '-': out = Calculator_sub(calc, a, b); break;
            case '*': case 'x': case 'X': out = Calculator_mul(calc, a, b); break;
            case '/': out = Calculator_div(calc, a, b); if (b==0) puts("error: division by zero -> 0"); break;
            default:  puts("operator tidak dikenal (pakai + - * /)"); continue;
        }
        calc->result = out;
        printf("= %.4f\n", out);
    }

    Calculator_destroy(calc);
    puts("bye");
    return 0;
}
