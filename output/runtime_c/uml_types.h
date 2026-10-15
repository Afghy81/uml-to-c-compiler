/* ==========================================================================
 * uml_types.h - Tipe data dasar untuk kode hasil generate UML-to-C Compiler
 * Bagian dari UML-to-C Runtime Library
 * Standar: ISO C99
 * ========================================================================== */
#ifndef UML_TYPES_H
#define UML_TYPES_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* --------------------------------------------------------------------------
 * Konfigurasi Ukuran Tetap (dapat di-override oleh user sebelum #include)
 * -------------------------------------------------------------------------- */
#ifndef UML_MAX_STRING_LEN
#define UML_MAX_STRING_LEN 64
#endif

#ifndef UML_MAX_INSTANCES
#define UML_MAX_INSTANCES 32
#endif

#ifndef UML_MAX_ASSOC_LINKS
#define UML_MAX_ASSOC_LINKS 16
#endif

/* --------------------------------------------------------------------------
 * Tipe Data Dasar UML
 * -------------------------------------------------------------------------- */
typedef int32_t   uml_integer_t;
typedef float     uml_real_t;
typedef bool      uml_boolean_t;
typedef uint64_t  uml_timestamp_t;

/* String berukuran tetap untuk sistem embedded */
typedef struct {
    char data[UML_MAX_STRING_LEN];
    uint16_t length;
} uml_string_t;

/* --------------------------------------------------------------------------
 * Header Instans Universal (disematkan di awal setiap struct kelas)
 * -------------------------------------------------------------------------- */
typedef struct {
    uint32_t instance_id;
    bool     is_allocated;
    uint16_t class_num;       /* Nomor enumerasi kelas dalam domain */
} UML_InstanceHeader_t;

/* --------------------------------------------------------------------------
 * Utilitas String UML
 * -------------------------------------------------------------------------- */
static inline void uml_string_set(uml_string_t* s, const char* src) {
    if (s == NULL || src == NULL) return;
    size_t i = 0;
    while (src[i] != '\0' && i < (UML_MAX_STRING_LEN - 1)) {
        s->data[i] = src[i];
        i++;
    }
    s->data[i] = '\0';
    s->length = (uint16_t)i;
}

static inline const char* uml_string_get(const uml_string_t* s) {
    if (s == NULL) return "";
    return s->data;
}

static inline bool uml_string_eq(const uml_string_t* a, const uml_string_t* b) {
    if (a == NULL || b == NULL) return false;
    if (a->length != b->length) return false;
    for (uint16_t i = 0; i < a->length; i++) {
        if (a->data[i] != b->data[i]) return false;
    }
    return true;
}

static inline bool uml_string_eq_cstr(const uml_string_t* a, const char* b) {
    if (a == NULL || b == NULL) return false;
    size_t i = 0;
    while (b[i] != '\0' && i < a->length) {
        if (a->data[i] != b[i]) return false;
        i++;
    }
    return (i == a->length && b[i] == '\0');
}

#endif /* UML_TYPES_H */
