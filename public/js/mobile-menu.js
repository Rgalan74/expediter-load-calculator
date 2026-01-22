/**
 * mobile-menu.js
 * Lógica del menú móvil hamburguesa
 * Extraído de app.html para mejor organización
 * Versión: 1.0.0
 */

document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("menuToggle");
    const menu = document.getElementById("mobileMenu");

    /**
     * Función para cerrar el menú móvil
     */
    function closeMobileMenu() {
        if (menu && !menu.classList.contains("scale-y-0")) {
            menu.classList.remove("scale-y-100", "opacity-100");
            menu.classList.add("scale-y-0", "opacity-0");
            setTimeout(() => {
                if (menu.classList.contains("scale-y-0")) {
                    menu.classList.add("hidden");
                }
            }, 300);
        }
    }

    /**
     * Función para mostrar/ocultar botón hamburguesa según el tamaño de pantalla
     */
    function updateMenuToggle() {
        if (window.innerWidth >= 768) {
            toggle.style.display = "none";
        } else {
            toggle.style.display = "block";
        }
    }

    if (toggle && menu) {
        // Inicializar visibilidad del botón hamburguesa
        updateMenuToggle();
        window.addEventListener("resize", updateMenuToggle);

        // Toggle del menú hamburguesa
        toggle.addEventListener("click", () => {
            if (menu.classList.contains("scale-y-0")) {
                // Mostrar menú con animación
                menu.classList.remove("hidden", "scale-y-0", "opacity-0");
                menu.classList.add("scale-y-100", "opacity-100");
            } else {
                // Ocultar menú con animación
                closeMobileMenu();
            }
        });

        // 1. Cerrar menú al hacer clic en cualquier tab del menú móvil
        const mobileMenuTabs = menu.querySelectorAll(".tab-link");
        mobileMenuTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                closeMobileMenu();
            });
        });

        // 2. Cerrar menú al hacer clic fuera de él
        document.addEventListener("click", (event) => {
            // Si el menú está visible
            if (!menu.classList.contains("scale-y-0")) {
                // Si el clic NO fue en el menú ni en el botón hamburguesa
                if (!menu.contains(event.target) && !toggle.contains(event.target)) {
                    closeMobileMenu();
                }
            }
        });
    }
});
