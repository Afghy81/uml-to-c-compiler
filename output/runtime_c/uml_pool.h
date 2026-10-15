/* ==========================================================================
 * uml_pool.h - Static Memory Pool Allocator (Free-List Pattern)
 * Bagian dari UML-to-C Runtime Library
 *
 * Penggunaan:
 *   DEFINE_STATIC_POOL(Door, Door_t, 8)
 *   Door_t* d = Door_pool_alloc();
 *   Door_pool_free(d);
 * ========================================================================== */
#ifndef UML_POOL_H
#define UML_POOL_H

#include "uml_types.h"
#include "uml_port.h"

/* --------------------------------------------------------------------------
 * Makro Pembangkit Static Pool untuk Setiap Kelas
 *
 * Parameter:
 *   ClassName - Nama kelas (prefix fungsi)
 *   TypeName  - Tipe struct (misal Door_t)
 *   Capacity  - Jumlah instans maksimum
 * -------------------------------------------------------------------------- */
#define DEFINE_STATIC_POOL(ClassName, TypeName, Capacity)                      \
                                                                               \
static TypeName s_pool_buf_##ClassName[Capacity];                              \
static bool     s_pool_used_##ClassName[Capacity];                             \
static uint32_t s_pool_count_##ClassName = 0;                                  \
                                                                               \
TypeName* ClassName##_pool_alloc(void) {                                       \
    for (size_t i = 0; i < (size_t)(Capacity); ++i) {                          \
        if (!s_pool_used_##ClassName[i]) {                                     \
            s_pool_used_##ClassName[i] = true;                                 \
            s_pool_count_##ClassName++;                                         \
            ClassName##_init(&s_pool_buf_##ClassName[i], (uint32_t)(i + 1));    \
            return &s_pool_buf_##ClassName[i];                                 \
        }                                                                      \
    }                                                                          \
    UML_ERROR_HOOK(UML_ERR_POOL_EXHAUSTED, #ClassName " pool exhausted");      \
    return NULL;                                                               \
}                                                                              \
                                                                               \
void ClassName##_pool_free(TypeName* inst) {                                   \
    if (inst == NULL) return;                                                  \
    ptrdiff_t idx = inst - s_pool_buf_##ClassName;                             \
    if (idx >= 0 && idx < (ptrdiff_t)(Capacity)) {                             \
        if (s_pool_used_##ClassName[idx]) {                                    \
            ClassName##_destroy(inst);                                         \
            s_pool_used_##ClassName[idx] = false;                              \
            s_pool_count_##ClassName--;                                         \
        }                                                                      \
    }                                                                          \
}                                                                              \
                                                                               \
uint32_t ClassName##_pool_count(void) {                                        \
    return s_pool_count_##ClassName;                                            \
}                                                                              \
                                                                               \
TypeName* ClassName##_pool_iter_begin(void) {                                  \
    return &s_pool_buf_##ClassName[0];                                          \
}                                                                              \
                                                                               \
TypeName* ClassName##_pool_iter_end(void) {                                    \
    return &s_pool_buf_##ClassName[Capacity];                                   \
}                                                                              \
                                                                               \
bool ClassName##_pool_is_allocated(const TypeName* inst) {                     \
    if (inst == NULL) return false;                                            \
    ptrdiff_t idx = inst - s_pool_buf_##ClassName;                             \
    if (idx < 0 || idx >= (ptrdiff_t)(Capacity)) return false;                 \
    return s_pool_used_##ClassName[idx];                                        \
}

/* --------------------------------------------------------------------------
 * Makro Helper untuk iterasi seluruh instans yang dialokasikan
 * -------------------------------------------------------------------------- */
#define UML_POOL_FOR_EACH(ClassName, TypeName, var)                            \
    for (TypeName* var = ClassName##_pool_iter_begin();                         \
         var != ClassName##_pool_iter_end(); ++var)                             \
        if (ClassName##_pool_is_allocated(var))

#endif /* UML_POOL_H */
