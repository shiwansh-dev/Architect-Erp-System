"use client";
import React, { useEffect, useRef, useState,useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useAllowedPath } from "../hooks/useAllowedPath";
import {
  BoxCubeIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  PlugInIcon,
  UserCircleIcon,
} from "../icons/index";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [
      { name: "Ecommerce", path: "/ecommerce", pro: false },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "User Profile",
    path: "/profile",
  },
  {
    icon: <UserCircleIcon />,
    name: "User Management",
    path: "/users",
  },
  {
    icon: <GridIcon />,
    name: "Master",
    subItems: [
      { name: "Items", path: "/Master/Items", pro: false },
      { name: "Unit", path: "/Master/Unit", pro: false },
      { name: "Item Type", path: "/Master/itemtype", pro: false },
      { name: "Machine", path: "/Master/machine", pro: false },
      { name: "Process", path: "/Master/process-links", pro: false },
      { name: "Customer", path: "/Master/customers", pro: false },
      { name: "Roles", path: "/Master/roles", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Templates",
    subItems: [
      { name: "FMS Template", path: "/Templates/fms-template", pro: false },
      { name: "FMS Table", path: "/Templates/fms-template/table", pro: false },
      { name: "FMS Flow", path: "/Templates/fms-template/flow", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "Projects",
    subItems: [
      { name: "Projects", path: "/Templates/projects", pro: false },
      { name: "New Project", path: "/Templates/new-project", pro: false },
    ],
  },
  {
    icon: <UserCircleIcon />,
    name: "Admin",
    subItems: [
      { name: "Delete Approval", path: "/Templates/projects/delete-approval", pro: false },
    ],
  },
];

const othersItems: NavItem[] = [
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [
      { name: "Sign In", path: "/signin", pro: false },
      { name: "Sign Up", path: "/signup", pro: false },
    ],
  },
];

const primaryNavItems = navItems;
const factoryManagementItems: NavItem[] = [];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [allowedPaths, setAllowedPaths] = useState<Set<string> | null>(null);
  const allowedPath = useAllowedPath();

  // Read allowedPaths from localStorage (set on login)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const raw = localStorage.getItem('user');
      let paths: string[] = [];
      let userRole = '';
      
      if (raw) {
        const u = JSON.parse(raw);
        if (Array.isArray(u.allowedPaths)) {
          paths = u.allowedPaths;
        }
        if (u.role) {
          userRole = u.role;
        }
      }
      
      // If user has admin role, show all menu items (set allowedPaths to null)
      if (userRole === 'admin') {
        setAllowedPaths(null);
      } else {
        // Fallback: use separate key if present
        if (paths.length === 0) {
          const saved = localStorage.getItem('allowedPaths');
          if (saved) {
            const arr = JSON.parse(saved);
            if (Array.isArray(arr)) paths = arr;
          }
        }
        
        setAllowedPaths(paths.length > 0 ? new Set<string>(paths) : null);
      }
    } catch {
      setAllowedPaths(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getVisibleNavItems = useCallback(
    (items: NavItem[]) =>
      items.filter((nav) => {
        if (!nav.subItems && nav.path && allowedPaths && allowedPaths.size > 0) {
          return allowedPaths.has(nav.path);
        }

        if (nav.subItems) {
          const filteredSubItems = nav.subItems.filter((subItem) => {
            if (allowedPaths && allowedPaths.size > 0) {
              return allowedPaths.has(subItem.path);
            }
            return true;
          });
          return filteredSubItems.length > 0;
        }

        return true;
      }),
    [allowedPaths]
  );

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-4">
      {navItems.map((nav, index) => {
        // If this item has a direct path, honor allowedPaths
        if (!nav.subItems && nav.path && allowedPaths && allowedPaths.size > 0) {
          if (!allowedPaths.has(nav.path)) {
            return null;
          }
        }

        // If this item has subItems, pre-filter them; hide section if none allowed
        const filteredSubItems = nav.subItems
          ? nav.subItems.filter((subItem) => {
              if (allowedPaths && allowedPaths.size > 0) {
                return allowedPaths.has(subItem.path);
              }
              return true;
            })
          : undefined;

        if (nav.subItems && filteredSubItems && filteredSubItems.length === 0) {
          return null;
        }

        return (
        <li key={nav.name}>
          {filteredSubItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group  ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "menu-item-icon-active"
                    : "menu-item-icon-inactive"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`menu-item-text`}>{nav.name}</span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className={`ml-auto w-5 h-5 transition-transform duration-200  ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-brand-500"
                      : ""
                  }`}>
                  <ChevronDownIcon />
                </span>
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group ${
                  isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                }`}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "menu-item-icon-active"
                      : "menu-item-icon-inactive"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className={`menu-item-text`}>{nav.name}</span>
                )}
              </Link>
            )
          )}
          {filteredSubItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-2 space-y-1 ml-9">
                {filteredSubItems
                  .map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item ${
                        isActive(subItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                      }`}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
        );
      })}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => path === pathname;
   const isActive = useCallback((path: string) => path === pathname, [pathname]);

  useEffect(() => {
    // Check if the current path matches any submenu item
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          nav.subItems.forEach((subItem) => {
            if (isActive(subItem.path)) {
              setOpenSubmenu({
                type: menuType as "main" | "others",
                index,
              });
              submenuMatched = true;
            }
          });
        }
      });
    });

    // If no submenu item matches, close the open submenu
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname,isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      <aside
        className={`fixed-sidebar flex flex-col px-5 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 transition-all duration-300 ease-in-out border-r border-gray-200 
          ${
            isExpanded || isMobileOpen
              ? "w-[290px]"
              : isHovered
              ? "w-[290px]"
              : "w-[90px]"
          }
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
        onMouseEnter={() => !isExpanded && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`py-2 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"}`}>
          <div className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-8 w-32"></div>
        </div>
        <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1 min-h-0">
          <nav className="mb-6 flex-1">
            <div className="flex flex-col gap-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-4"></div>
                <div className="space-y-2">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </aside>
    );
  }

  const visibleFactoryManagementItems = getVisibleNavItems(factoryManagementItems);
  const visibleOtherItems = getVisibleNavItems(othersItems);

  return (
    <aside
      className={`fixed-sidebar flex flex-col px-5 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 transition-all duration-300 ease-in-out border-r border-gray-200 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-2 flex  ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href={allowedPath}>
          {isExpanded || isHovered || isMobileOpen ? (
            <Image
              src="/images/logo/tranceed.png"
              alt="Tranceed Technology Logo"
              width={700}
              height={160}
              priority
              style={{ height: 160, width: "auto" }}
            />
          ) : (
            <Image
              src="/images/logo/logo.jpeg"
              alt="Tranceed Technology Icon"
              width={32}
              height={32}
              priority
            />
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar flex-1 min-h-0">
        <nav className="mb-6 flex-1">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(primaryNavItems, "main")}
            </div>

            {visibleFactoryManagementItems.length > 0 && (
              <div>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <h2 className="mb-4 text-xs uppercase flex leading-[20px] text-gray-400 justify-start">
                    Factory Management
                  </h2>
                )}
                {renderMenuItems(factoryManagementItems, "main")}
              </div>
            )}

            {visibleOtherItems.length > 0 && (
              <div className="">
                {renderMenuItems(othersItems, "others")}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
