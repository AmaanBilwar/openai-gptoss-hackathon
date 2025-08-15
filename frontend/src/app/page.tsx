import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Github,
  Zap,
  GitBranch,
  GitMerge,
  Sparkles,
  Users,
  Code,
  ArrowRight,
  Star,
  Download,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function KiteLandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="neuro-icon w-10 h-10 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="font-bold text-2xl text-foreground">Kite</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#features"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                How It Works
              </a>
              <a
                href="#open-source"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Open Source
              </a>
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                className="neuro-button gap-2 bg-transparent"
              >
                <Github className="w-4 h-4" />
                GitHub
              </Button>
              <Button className="neuro-button gap-2 glow-effect">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <Badge
              variant="secondary"
              className="mb-8 gap-2 neuro-button floating-element"
            >
              <Star className="w-4 h-4" />
              Open Source & Free Forever
            </Badge>
            <h1 className="font-black text-5xl md:text-7xl lg:text-8xl text-foreground mb-8 leading-tight">
              Kite: Beyond the <span className="text-primary">Conflicts</span>
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground mb-6 font-medium">
              Your AI Co-pilot for Effortless GitHub Workflows
            </p>
            <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
              Stop wrestling with complex GitHub Actions, messy PRs, and merge
              conflicts. Kite intelligently automates your workflow with natural
              language commands.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
              <Button
                size="lg"
                className="neuro-button gap-3 text-lg px-10 py-7 glow-effect"
              >
                <Download className="w-6 h-6" />
                Get Started with Kite
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="neuro-button gap-3 text-lg px-10 py-7 bg-transparent"
              >
                <Github className="w-6 h-6" />
                Explore on GitHub
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-bold text-4xl md:text-5xl text-foreground mb-8">
              Tired of Git Headaches?
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Complex GitHub Actions configurations, overwhelming pull requests,
              and merge conflicts that bring development to a halt. Sound
              familiar? You're not alone.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="glass-card p-8 text-center floating-element">
              <div className="neuro-icon w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Code className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl mb-4">Complex YAML</h3>
              <p className="text-muted-foreground leading-relaxed">
                Wrestling with GitHub Actions syntax instead of building
                features
              </p>
            </Card>
            <Card
              className="glass-card p-8 text-center floating-element"
              style={{ animationDelay: "1s" }}
            >
              <div className="neuro-icon w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <GitBranch className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl mb-4">Messy PRs</h3>
              <p className="text-muted-foreground leading-relaxed">
                Large, unfocused pull requests that slow down reviews
              </p>
            </Card>
            <Card
              className="glass-card p-8 text-center floating-element"
              style={{ animationDelay: "2s" }}
            >
              <div className="neuro-icon w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <GitMerge className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-xl mb-4">Merge Conflicts</h3>
              <p className="text-muted-foreground leading-relaxed">
                Hours lost resolving conflicts that break development flow
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="font-bold text-4xl md:text-5xl text-foreground mb-8">
              Unlock a Smarter Git Workflow
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Kite transforms how you work with GitHub through intelligent
              automation and AI-powered assistance.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <Card className="glass-card p-10 hover:scale-105 transition-all duration-300">
              <div className="neuro-icon w-16 h-16 rounded-2xl flex items-center justify-center mb-8">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-2xl mb-6">
                Natural Language to GitHub Actions
              </h3>
              <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
                Convert simple prompts into powerful, ready-to-use GitHub Action
                workflows. Stop wrestling with YAML, start building.
              </p>
              <Badge variant="secondary" className="neuro-button">
                Speed & Automation
              </Badge>
            </Card>

            <Card className="glass-card p-10 hover:scale-105 transition-all duration-300">
              <div className="neuro-icon w-16 h-16 rounded-2xl flex items-center justify-center mb-8">
                <GitBranch className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-2xl mb-6">
                Smart PR Splitting & Management
              </h3>
              <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
                Automatically identify and suggest breaking down large, complex
                Pull Requests into smaller, manageable chunks using LLMs and
                embeddings.
              </p>
              <Badge variant="secondary" className="neuro-button">
                Faster Reviews
              </Badge>
            </Card>

            <Card className="glass-card p-10 hover:scale-105 transition-all duration-300">
              <div className="neuro-icon w-16 h-16 rounded-2xl flex items-center justify-center mb-8">
                <GitMerge className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-2xl mb-6">
                Effortless Merge Conflict Resolution
              </h3>
              <p className="text-muted-foreground mb-8 leading-relaxed text-lg">
                Kite intelligently detects merge conflicts, extracts conflicting
                code, and generates precise resolution code using LLMs and
                morphLLM.
              </p>
              <Badge variant="secondary" className="neuro-button">
                Eliminate Nightmares
              </Badge>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="font-bold text-4xl md:text-5xl text-foreground mb-8">
              Simple. Intelligent. Automated.
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Kite works seamlessly with your existing workflow, adding
              intelligence where you need it most.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="space-y-10">
              <div className="flex gap-6 items-start">
                <div className="neuro-icon w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-3">
                    Describe What You Need
                  </h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Use natural language to describe your GitHub workflow needs
                  </p>
                </div>
              </div>
              <div className="flex gap-6 items-start">
                <div className="neuro-icon w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-3">
                    Kite Analyzes & Generates
                  </h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    AI processes your request and creates optimized solutions
                  </p>
                </div>
              </div>
              <div className="flex gap-6 items-start">
                <div className="neuro-icon w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-3">Deploy & Iterate</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    Review, customize, and deploy your automated workflows
                  </p>
                </div>
              </div>
            </div>
            <Card className="glass-card p-8">
              <div className="bg-background/50 rounded-lg p-6 font-mono text-sm backdrop-blur-sm">
                <div className="text-blue-400 mb-2">
                  $ kite action "Deploy to staging on PR"
                </div>
                <div className="text-muted-foreground mb-2">
                  Analyzing request...
                </div>
                <div className="text-muted-foreground mb-2">
                  Generating GitHub Action...
                </div>
                <div className="text-emerald-400">
                  Created .github/workflows/staging-deploy.yml
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section id="open-source" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="font-bold text-4xl md:text-5xl text-foreground mb-8">
              Your Code, Your Control
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Kite is proudly open-source, giving you full transparency and the
              ability to contribute. Integrate your own API keys for OpenRouter,
              tapping into a vast ecosystem of cutting-edge LLMs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-16 items-center">
            <Card className="glass-card p-10">
              <div className="flex items-center gap-6 mb-8">
                <div className="neuro-icon w-16 h-16 rounded-2xl flex items-center justify-center">
                  <Users className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-bold text-2xl">Community Driven</h3>
                  <p className="text-muted-foreground text-lg">
                    Built by developers, for developers
                  </p>
                </div>
              </div>
              <ul className="space-y-4 text-muted-foreground text-lg">
                <li className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0" />
                  Full source code transparency
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-emerald-400 rounded-full flex-shrink-0" />
                  Community contributions welcome
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-purple-400 rounded-full flex-shrink-0" />
                  No vendor lock-in
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-orange-400 rounded-full flex-shrink-0" />
                  Bring your own LLM APIs
                </li>
              </ul>
            </Card>

            <div className="space-y-8">
              <h3 className="font-bold text-3xl">
                Flexible for Every Workflow
              </h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                Use Kite completely free and self-hosted locally, or opt for our
                upcoming freemium service for enhanced features and hassle-free
                cloud hosting.
              </p>
              <div className="flex flex-col sm:flex-row gap-6">
                <Button className="neuro-button gap-3 text-lg px-8 py-6 glow-effect">
                  <Github className="w-5 h-5" />
                  Join Our Community
                </Button>
                <Button
                  variant="outline"
                  className="neuro-button gap-3 text-lg px-8 py-6 bg-transparent"
                >
                  Learn About Pricing
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-emerald-600/20" />
        <Card className="glass-card max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="font-bold text-4xl md:text-5xl mb-8">
            Ready to Transform Your GitHub Workflow?
          </h2>
          <p className="text-xl mb-10 text-muted-foreground">
            Join thousands of developers who've already moved beyond the
            conflicts.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button
              size="lg"
              className="neuro-button gap-3 text-lg px-10 py-7 glow-effect"
            >
              <Download className="w-6 h-6" />
              Get Started with Kite
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="neuro-button gap-3 text-lg px-10 py-7 bg-transparent"
            >
              <Github className="w-6 h-6" />
              Star on GitHub
            </Button>
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-3 mb-6 md:mb-0">
              <div className="neuro-icon w-10 h-10 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="font-bold text-2xl text-foreground">Kite</span>
            </div>
            <div className="flex items-center space-x-8">
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Features
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                Community
              </a>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border/50 text-center text-muted-foreground">
            <p>&copy; 2025 Kite. Open source and free forever.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
