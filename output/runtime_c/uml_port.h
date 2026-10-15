/* ==========================================================================
 * uml_port.h - Abstraksi portabilitas platform (logging, assertion, timing)
 * Bagian dari UML-to-C Runtime Library
 * ========================================================================== */
#ifndef UML_PORT_H
#define UML_PORT_H

#include <stdio.h>
#include <stdlib.h>

/* --------------------------------------------------------------------------
 * Konfigurasi Build Mode
 * -------------------------------------------------------------------------- */
#ifndef UML_DEBUG
#define UML_DEBUG 1
#endif

/* --------------------------------------------------------------------------
 * Logging
 * -------------------------------------------------------------------------- */
#if UML_DEBUG
    #define UML_LOG(fmt, ...) \
        printf("[UML] " fmt "\n", ##__VA_ARGS__)
    #define UML_LOG_SM(inst_name, inst_id, fmt, ...) \
        printf("[SM %s:#%u] " fmt "\n", (inst_name), (inst_id), ##__VA_ARGS__)
    #define UML_LOG_ERR(fmt, ...) \
        fprintf(stderr, "[UML ERR] " fmt "\n", ##__VA_ARGS__)
#else
    #define UML_LOG(fmt, ...)              ((void)0)
    #define UML_LOG_SM(inst_name, inst_id, fmt, ...) ((void)0)
    #define UML_LOG_ERR(fmt, ...)          ((void)0)
#endif

/* --------------------------------------------------------------------------
 * Assertion
 * -------------------------------------------------------------------------- */
#if UML_DEBUG
    #define UML_ASSERT(cond) \
        do { \
            if (!(cond)) { \
                fprintf(stderr, "[UML ASSERT FAIL] %s:%d: %s\n", \
                        __FILE__, __LINE__, #cond); \
                abort(); \
            } \
        } while (0)
#else
    #define UML_ASSERT(cond) ((void)0)
#endif

/* --------------------------------------------------------------------------
 * Error Hook (user-overridable)
 * -------------------------------------------------------------------------- */
#ifndef UML_ERROR_HOOK
#define UML_ERROR_HOOK(code, msg) \
    UML_LOG_ERR("Error %d: %s", (int)(code), (msg))
#endif

typedef enum {
    UML_ERR_NONE = 0,
    UML_ERR_POOL_EXHAUSTED,
    UML_ERR_QUEUE_FULL,
    UML_ERR_INVALID_EVENT,
    UML_ERR_INVALID_STATE,
    UML_ERR_NULL_POINTER,
    UML_ERR_RELATE_FAILED
} UML_ErrorCode_t;

#endif /* UML_PORT_H */
