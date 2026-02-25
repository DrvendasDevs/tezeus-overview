import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            // Base
            "group toast group-[.toaster]:border group-[.toaster]:shadow-lg " +
            // Light
            "group-[.toaster]:bg-white group-[.toaster]:text-gray-900 group-[.toaster]:border-[#d4d4d4] " +
            // Dark
            "dark:group-[.toaster]:bg-[#1f1f1f] dark:group-[.toaster]:text-gray-100 dark:group-[.toaster]:border-gray-700",
          title:
            "font-semibold group-[.toast]:text-gray-900 dark:group-[.toast]:text-gray-100",
          description:
            "group-[.toast]:text-sm group-[.toast]:text-gray-600 dark:group-[.toast]:text-gray-300",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-none",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-none",
          closeButton:
            "group-[.toast]:text-gray-500 hover:group-[.toast]:text-gray-700 dark:group-[.toast]:text-gray-400 dark:hover:group-[.toast]:text-gray-200",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
